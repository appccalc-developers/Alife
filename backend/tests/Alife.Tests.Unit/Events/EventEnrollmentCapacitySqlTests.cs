using System.Text.Json;
using Alife.Application.Common.Models;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using NSubstitute;

namespace Alife.Tests.Unit.Events;

public sealed class EventEnrollmentCapacitySqlTests
{
    [DisposableSqlFact]
    public async Task AdditiveMigration_PreservesLegacyEnrollmentEvidenceAndPackageRules()
    {
        var database = "AlifePreparationTest_" + Guid.NewGuid().ToString("N");
        var connection = new SqlConnectionStringBuilder { DataSource = "localhost,14333", InitialCatalog = database, UserID = "sa",
            Password = Environment.GetEnvironmentVariable("ALIFE_LOCAL_SQL_PASSWORD") ?? "AlifeDevPass123", TrustServerCertificate = true, Encrypt = false };
        await using var db = new AlifeDbContext(new DbContextOptionsBuilder<AlifeDbContext>().UseSqlServer(connection.ConnectionString).UseSnakeCaseNamingConvention().Options);
        try
        {
            await db.Database.EnsureCreatedAsync();
            var member = new Member { Id = Guid.NewGuid(), DisplayName = "Legacy fixture" };
            var group = new Group { Id = Guid.NewGuid() };
            var e = new GroupEvent { Id = Guid.NewGuid(), GroupId = group.Id, CreatedByMemberId = member.Id, AccountableOwnerMemberId = member.Id, StartDate = DateTime.UtcNow.AddDays(2), EndDate = DateTime.UtcNow.AddDays(3) };
            var enrollment = new EventEnrollment { Id = Guid.NewGuid(), GroupId = group.Id, EventId = e.Id, MemberId = member.Id, EnrollmentJson = "{\"consentEvidence\":\"original\"}", CreatedUtc = new DateTime(2025, 1, 1) };
            db.Members.Add(member); db.Groups.Add(group); db.GroupEvents.Add(e); db.EventEnrollments.Add(enrollment);
            db.EventChildRegistrations.Add(new() { Id = Guid.NewGuid(), EventId = e.Id, EnrollmentId = enrollment.Id, ChildMemberId = member.Id, CreatedByMemberId = member.Id, CreatedUtc = DateTime.UtcNow });
            var policy = new EventPackageGovernancePolicyVersion { Id = Guid.NewGuid(), Version = "fixture", SchemaVersion = "1", RulesJson = "{}", PublishedByMemberId = member.Id };
            db.EventPackageGovernancePolicyVersions.Add(policy);
            db.EventPackages.Add(new() { Id = Guid.NewGuid(), EventId = e.Id, GovernancePolicyVersionId = policy.Id, GeneratedByMemberId = member.Id, ContentHash = "fixture", SourceVectorHash = "fixture" });
            await db.SaveChangesAsync(); db.ChangeTracker.Clear();
            var assembly = db.GetService<IMigrationsAssembly>();
            var migration = assembly.CreateMigration(assembly.Migrations["20260913135531_EventPreparationAuthoringCapacityRoster"], db.Database.ProviderName!);
            var generator = db.GetService<IMigrationsSqlGenerator>();
            // Reconstruct the immediately preceding schema only in this disposable database,
            // then execute the actual additive migration against populated historical records.
            foreach (var command in generator.Generate(migration.DownOperations)) await db.Database.ExecuteSqlRawAsync(command.CommandText);
            foreach (var command in generator.Generate(migration.UpOperations, db.Model)) await db.Database.ExecuteSqlRawAsync(command.CommandText);
            var legacy = await db.EventEnrollments.AsNoTracking().SingleAsync();
            Assert.Equal("confirmed", legacy.Status); Assert.Null(legacy.QueuedUtc); Assert.Null(legacy.StatusChangedUtc);
            Assert.Equal(enrollment.CreatedUtc, legacy.CreatedUtc); Assert.Equal(enrollment.EnrollmentJson, legacy.EnrollmentJson);
            Assert.Equal(enrollment.Id, (await db.EventChildRegistrations.SingleAsync()).EnrollmentId);
            Assert.Equal(1, (await db.EventPackages.SingleAsync()).RosterRulesVersion);
            Assert.Empty(db.NotificationMessages); Assert.Empty(db.EventEnrollmentHistory); Assert.Empty(db.EventRosterDefaults);
        }
        finally
        {
            if (connection.DataSource != "localhost,14333" || !database.StartsWith("AlifePreparationTest_", StringComparison.Ordinal)) throw new InvalidOperationException("Refusing cleanup outside the disposable test database.");
            await db.Database.EnsureDeletedAsync();
        }
    }
    [DisposableSqlFact]
    public async Task LastSeat_ConcurrentRequests_CancellationAndPromotion_AreAtomicAndPreserveEvidence()
    {
        var database = "AlifePreparationTest_" + Guid.NewGuid().ToString("N");
        var connection = new SqlConnectionStringBuilder { DataSource = "localhost,14333", InitialCatalog = database, UserID = "sa",
            Password = Environment.GetEnvironmentVariable("ALIFE_LOCAL_SQL_PASSWORD") ?? "AlifeDevPass123", TrustServerCertificate = true, Encrypt = false };
        AlifeDbContext Open() => new(new DbContextOptionsBuilder<AlifeDbContext>().UseSqlServer(connection.ConnectionString).UseSnakeCaseNamingConvention().Options);
        var groupId = Guid.NewGuid(); var eventId = Guid.NewGuid(); var people = Enumerable.Range(0, 8).Select(_ => Guid.NewGuid()).ToArray();
        var requested = people.ToDictionary(x => x, _ => Guid.NewGuid());
        IGroupAuthorizationService Auth(AlifeDbContext context)
        {
            var auth = Substitute.For<IGroupAuthorizationService>();
            auth.IsApprovedMemberAsync(groupId, Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(call => context.GroupMemberships.AnyAsync(x => x.GroupId == groupId && x.MemberId == call.ArgAt<Guid>(1) && x.Status == MembershipStatus.Approved));
            return auth;
        }
        await using var setup = Open();
        try
        {
            await setup.Database.EnsureCreatedAsync();
            setup.Groups.Add(new() { Id = groupId }); setup.Members.AddRange(people.Select(id => new Member { Id = id, DisplayName = "Fixture member" }));
            setup.GroupMemberships.AddRange(people.Select(id => new GroupMembership { Id = Guid.NewGuid(), GroupId = groupId, MemberId = id, Status = MembershipStatus.Approved }));
            setup.GroupEvents.Add(new() { Id = eventId, GroupId = groupId, AccountableOwnerMemberId = people[0], CreatedByMemberId = people[0], StartDate = DateTime.UtcNow.AddDays(5), EndDate = DateTime.UtcNow.AddDays(6),
                RegistrationStatus = EventRegistrationStatus.Open, EventDataJson = JsonSerializer.Serialize(new { maxCapacity = 1, registrationDeadline = DateTime.UtcNow.AddDays(4) }) });
            await setup.SaveChangesAsync(); setup.ChangeTracker.Clear();
            var results = await Task.WhenAll(people.Select(async member => {
                await using var db = Open(); return await new EventEnrollmentCapacityService(db, Auth(db)).MutateAsync(eventId, member, "create", "{\"proof\":\"original\"}", requested[member], true, default);
            }));
            Assert.All(results, x => Assert.True(x.IsSuccess, x.Message));
            Assert.Single(results, x => x.Value!.Status == "confirmed"); Assert.Equal(7, results.Count(x => x.Value!.Status == "waitlisted"));
            var original = results.Single(x => x.Value!.Status == "confirmed").Value!;
            var waiting = await setup.EventEnrollments.AsNoTracking().Where(x => x.EventId == eventId && x.Status == "waitlisted").ToListAsync();
            waiting = waiting.OrderBy(x => x.QueuedUtc).ThenBy(x => x.Id).ToList();
            // A linked child record must survive participant cancellation.
            var child = new EventChildRegistration { Id = Guid.NewGuid(), EventId = eventId, EnrollmentId = original.Id, ChildMemberId = original.MemberId, CreatedByMemberId = original.MemberId, CreatedUtc = DateTime.UtcNow };
            setup.EventChildRegistrations.Add(child); await setup.SaveChangesAsync(); setup.ChangeTracker.Clear();
            // Skip a no-longer-eligible candidate but preserve its history and place in the queue.
            var lost = await setup.GroupMemberships.SingleAsync(x => x.GroupId == groupId && x.MemberId == waiting[0].MemberId); lost.Status = MembershipStatus.Removed; await setup.SaveChangesAsync(); setup.ChangeTracker.Clear();
            await Task.WhenAll(Enumerable.Range(0, 2).Select(async _ => {
                await using var db = Open(); var result = await new EventEnrollmentCapacityService(db, Auth(db)).MutateAsync(eventId, original.MemberId, "cancel", null, original.Id, false, default); Assert.True(result.IsSuccess, result.Message);
            }));
            Assert.Equal(waiting[1].Id, (await setup.EventEnrollments.AsNoTracking().SingleAsync(x => x.Status == "confirmed")).Id);
            Assert.Equal("cancelled", (await setup.EventEnrollments.AsNoTracking().SingleAsync(x => x.Id == original.Id)).Status);
            Assert.Equal(original.Id, (await setup.EventChildRegistrations.AsNoTracking().SingleAsync()).EnrollmentId);
            Assert.Single(await setup.NotificationMessages.AsNoTracking().Where(x => x.ActionType == "event.enrollment.promoted").ToListAsync());
            Assert.Contains(await setup.EventEnrollmentHistory.AsNoTracking().ToListAsync(), x => x.EnrollmentId == original.Id && x.EnrollmentJson.Contains("original"));
            await using (var db = Open())
            {
                var rejoined = await new EventEnrollmentCapacityService(db, Auth(db)).MutateAsync(eventId, original.MemberId, "create", "{\"proof\":\"new\"}", Guid.NewGuid(), true, default);
                Assert.True(rejoined.IsSuccess, rejoined.Message); Assert.Equal(original.Id, rejoined.Value!.Id); Assert.Equal(7, rejoined.Value.WaitlistPosition);
            }
            // Closed registration keeps the queue; increasing capacity only promotes after reopening.
            await using (var db = Open())
            {
                await using var tx = await db.BeginSerializableTransactionAsync(); await db.LockEventRegistrationAsync(eventId);
                var e = await db.GroupEvents.SingleAsync(); e.RegistrationStatus = EventRegistrationStatus.Closed;
                e.EventDataJson = JsonSerializer.Serialize(new { maxCapacity = 3, registrationDeadline = DateTime.UtcNow.AddDays(4) });
                await new EventEnrollmentCapacityService(db, Auth(db)).ReconcileAsync(e, people[0], default); await db.SaveChangesAsync(); await tx!.CommitAsync(default);
            }
            Assert.Equal(1, await setup.EventEnrollments.CountAsync(x => x.Status == "confirmed"));
            await using (var db = Open())
            {
                await using var tx = await db.BeginSerializableTransactionAsync(); await db.LockEventRegistrationAsync(eventId);
                var e = await db.GroupEvents.SingleAsync(); e.RegistrationStatus = EventRegistrationStatus.Open;
                await new EventEnrollmentCapacityService(db, Auth(db)).ReconcileAsync(e, people[0], default); await db.SaveChangesAsync(); await tx!.CommitAsync(default);
            }
            Assert.Equal(3, await setup.EventEnrollments.CountAsync(x => x.Status == "confirmed"));
            Assert.Equal(3, await setup.NotificationMessages.CountAsync());
            Assert.Equal("waitlisted", (await setup.EventEnrollments.AsNoTracking().SingleAsync(x => x.Id == waiting[0].Id)).Status);
        }
        finally
        {
            if (connection.DataSource != "localhost,14333" || !database.StartsWith("AlifePreparationTest_", StringComparison.Ordinal)) throw new InvalidOperationException("Refusing cleanup outside the disposable test database.");
            await setup.Database.EnsureDeletedAsync();
        }
    }
    private sealed class DisposableSqlFactAttribute : FactAttribute
    {
        public DisposableSqlFactAttribute() { if (Environment.GetEnvironmentVariable("ALIFE_TEST_PREPARATION_SQL") != "1") Skip = "Opt in to a disposable localhost,14333 SQL Server database using ALIFE_TEST_PREPARATION_SQL=1."; }
    }
}
