using System.Text.Json;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
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

public sealed class EventCollaborationSqlTests
{
    [DisposableSqlFact]
    public async Task ActualMigration_PreservesLegacyEnrollmentChildAndApprovalEvidence()
    {
        await using var fixture = new Database(); await using var db = fixture.Open();
        try
        {
            await db.Database.EnsureCreatedAsync();
            var seed = await Seed(db);
            var enrollment = new EventEnrollment { Id=Guid.NewGuid(),EventId=seed.Event.Id,GroupId=seed.Event.GroupId,MemberId=seed.Owner,
                Status="confirmed",EnrollmentJson="{\"family\":[\"unproven\"],\"consent\":\"original\"}",CreatedUtc=DateTime.UtcNow,UpdatedUtc=DateTime.UtcNow };
            db.EventEnrollments.Add(enrollment);
            var childId=Guid.NewGuid();
            db.EventChildRegistrations.Add(new() { Id=childId,EventId=seed.Event.Id,EnrollmentId=enrollment.Id,ChildMemberId=seed.Other,CreatedByMemberId=seed.Owner,CreatedUtc=DateTime.UtcNow });
            var policyId=Guid.NewGuid(); db.EventPackageGovernancePolicyVersions.Add(new() { Id=policyId,Version="migration",SchemaVersion="1",RulesJson="{}",PublishedByMemberId=seed.Owner });
            var packageId=Guid.NewGuid(); db.EventPackages.Add(new() { Id=packageId,EventId=seed.Event.Id,GovernancePolicyVersionId=policyId,GeneratedByMemberId=seed.Owner,ContentHash="original-evidence",SourceVectorHash="original-source" });
            await db.SaveChangesAsync(); db.ChangeTracker.Clear();
            var assembly=db.GetService<IMigrationsAssembly>();
            var migration=assembly.CreateMigration(assembly.Migrations.Single(x => x.Key.EndsWith("_EventCollaborationWorkspaces")).Value,db.Database.ProviderName!);
            var generator=db.GetService<IMigrationsSqlGenerator>();
            foreach(var command in generator.Generate(migration.DownOperations)) await db.Database.ExecuteSqlRawAsync(command.CommandText);
            foreach(var command in generator.Generate(migration.UpOperations,db.Model)) await db.Database.ExecuteSqlRawAsync(command.CommandText);
            Assert.Equal(enrollment.EnrollmentJson,(await db.EventEnrollments.SingleAsync()).EnrollmentJson);
            Assert.Equal(enrollment.Id,(await db.EventChildRegistrations.SingleAsync(x => x.Id==childId)).EnrollmentId);
            Assert.Equal("original-evidence",(await db.EventPackages.SingleAsync(x => x.Id==packageId)).ContentHash);
            Assert.Empty(await db.EventRegistrationParticipants.ToArrayAsync());
            Assert.Equal(0,(await db.GroupEvents.SingleAsync()).CollaborationVersion);
        }
        finally { await fixture.DeleteAsync(); }
    }

    [DisposableSqlFact]
    public async Task LastPlaceAndStandingReservations_SerializeConcurrentRequestsOnSqlServer()
    {
        await using var fixture=new Database(); SeedData seed; Guid firstApp; Guid secondApp; Guid venueId; string venueTag;
        try
        {
            await using(var db=fixture.Open())
            {
                await db.Database.EnsureCreatedAsync(); seed=await Seed(db); var service=Registration(db,seed.Event.Id);
                var text=new LocalizedTextDto("Instructions","说明");
                var rules=new RegistrationRules(text,"public",null,text,1,DateTime.UtcNow.AddDays(-1),DateTime.UtcNow.AddDays(2),true,"app",text,text,text,false,[]);
                Assert.True((await service.SaveRulesAsync(seed.Event.Id,seed.Owner,rules,"\"registration-new\"",default)).IsSuccess);
                async Task<Guid> Register(Guid actor)
                {
                    var created=await service.CreateAsync(seed.Event.Id,actor,new(actor,[new(actor,"Participant")]),Guid.NewGuid().ToString(),default);
                    Assert.True(created.IsSuccess,created.Message);
                    var app=await db.EventRegistrationApplications.Include(x=>x.Participants).SingleAsync(x=>x.Id==created.Value);
                    Assert.True((await service.ActAsync(seed.Event.Id,app.Id,actor,"consent",new(ParticipantId:app.Participants.Single().Id),EventRegistrationWorkService.ApplicationETag(app),Guid.NewGuid().ToString(),default)).IsSuccess);
                    return app.Id;
                }
                firstApp=await Register(seed.Owner); secondApp=await Register(seed.Other);
                var venue=new EventVenue { Id=Guid.NewGuid(),ManagingGroupId=seed.Event.GroupId,CreatedByMemberId=seed.Owner,NameEn="Hall",NameZh="主堂",Capacity=10,TimeZone="Australia/Perth" };
                db.EventVenues.Add(venue); await db.SaveChangesAsync(); venueId=venue.Id; venueTag=$"\"venue-{venue.ConcurrencyToken:N}\"";
            }
            async Task Complete(Guid appId,Guid actor)
            {
                await using var db=fixture.Open(); var app=await db.EventRegistrationApplications.SingleAsync(x=>x.Id==appId);
                var result=await Registration(db,seed.Event.Id).ActAsync(seed.Event.Id,appId,actor,"complete",new(),EventRegistrationWorkService.ApplicationETag(app),Guid.NewGuid().ToString(),default);
                Assert.True(result.IsSuccess,result.Message);
            }
            await Task.WhenAll(Complete(firstApp,seed.Owner),Complete(secondApp,seed.Other));
            async Task<AppResult<Guid>> Reserve(string key)
            {
                await using var db=fixture.Open(); var service=new EventVenueCalendarService(db,Substitute.For<IGroupAuthorizationService>(),Substitute.For<IEventPackageInvalidationService>());
                return await service.SaveWeeklyAsync(seed.Event.GroupId,venueId,seed.Owner,new(seed.Event.Id,new(2026,9,20),null,540,720,5),venueTag,key,default);
            }
            var bookings=await Task.WhenAll(Reserve("concurrent-weekly-one"),Reserve("concurrent-weekly-two"));
            Assert.Single(bookings,x=>x.IsSuccess); Assert.Single(bookings,x=>x.Status==AppResultStatus.PreconditionFailed);
            await using var check=fixture.Open();
            Assert.Equal(1,await check.EventRegistrationParticipants.CountAsync(x=>x.SeatStatus=="confirmed"));
            Assert.Equal(1,await check.EventRegistrationParticipants.CountAsync(x=>x.SeatStatus=="waitlisted"));
            Assert.Equal(1,await check.EventVenueWeeklyBookings.CountAsync());
        }
        finally { await fixture.DeleteAsync(); }
    }

    private static EventRegistrationWorkService Registration(AlifeDbContext db,Guid id)
    {
        var package=Substitute.For<IEventPackageService>(); package.IsRegistrationApprovalCurrentAsync(id,Arg.Any<CancellationToken>()).Returns(true);
        return new(db,Substitute.For<IEventPackageInvalidationService>(),package);
    }
    private static async Task<SeedData> Seed(AlifeDbContext db)
    {
        var owner=Guid.NewGuid(); var other=Guid.NewGuid(); var group=new Group { Id=Guid.NewGuid(),NameJson="{}" }; db.Groups.Add(group);
        foreach(var actor in new[]{owner,other})
        {
            db.Members.Add(new() { Id=actor,DisplayName="SQL fixture" });
            db.GroupMemberships.Add(new() { Id=Guid.NewGuid(),GroupId=group.Id,MemberId=actor,Status=MembershipStatus.Approved,Role=MembershipRole.Member });
        }
        var e=new GroupEvent { Id=Guid.NewGuid(),GroupId=group.Id,CreatedByMemberId=owner,AccountableOwnerMemberId=owner,StartDate=DateTime.UtcNow.AddDays(3),EndDate=DateTime.UtcNow.AddDays(4),EventDataJson="{\"visibility\":\"public\"}",PublicationStatus=EventPublicationStatus.Published,RegistrationStatus=EventRegistrationStatus.Open,ActivePlanVersion=1 };
        db.GroupEvents.Add(e);
        var facts=new EventFactSet { Id=Guid.NewGuid(),EventId=e.Id,Version=1,SchemaVersion="1.0.0",FactsJson="[]",SourceHash="fixture",CreatedByMemberId=owner }; db.EventFactSets.Add(facts);
        var plan=new EventCompositionEngine().Compose(new("1.0.0",null,new([]),[new("PEOPLE.REGISTRATION",true),new("PLACE.RESOURCE",true)]),new("\"sql\"",HasAccountableOwner:true)).Value!;
        db.EventPlanSnapshots.Add(new() { Id=Guid.NewGuid(),EventId=e.Id,SourceFactSetId=facts.Id,Version=1,SchemaVersion=plan.SchemaVersion,ProposalHash=plan.ProposalHash,ETag="\"sql-plan\"",SnapshotJson=EventCompositionPersistence.SerializePlan(plan,[]),IsActive=true,AcceptedByMemberId=owner });
        await db.SaveChangesAsync(); return new(e,owner,other);
    }
    private sealed record SeedData(GroupEvent Event,Guid Owner,Guid Other);
    private sealed class Database : IAsyncDisposable
    {
        private readonly string name="AlifeCollaborationTest_"+Guid.NewGuid().ToString("N");
        public AlifeDbContext Open()
        {
            var connection=new SqlConnectionStringBuilder { DataSource="localhost,14333",InitialCatalog=name,UserID="sa",Password=Environment.GetEnvironmentVariable("ALIFE_LOCAL_SQL_PASSWORD")??"AlifeDevPass123",TrustServerCertificate=true,Encrypt=false,ConnectTimeout=5 };
            return new(new DbContextOptionsBuilder<AlifeDbContext>().UseSqlServer(connection.ConnectionString).UseSnakeCaseNamingConvention().Options);
        }
        public async Task DeleteAsync()
        {
            if (!name.StartsWith("AlifeCollaborationTest_",StringComparison.Ordinal) || name.Length!=55) throw new InvalidOperationException("Refusing to delete a non-fixture database.");
            await using var db=Open(); await db.Database.EnsureDeletedAsync();
        }
        public ValueTask DisposeAsync()=>ValueTask.CompletedTask;
    }
    private sealed class DisposableSqlFactAttribute : FactAttribute
    {
        public DisposableSqlFactAttribute() { if(Environment.GetEnvironmentVariable("ALIFE_TEST_PREPARATION_SQL")!="1") Skip="Opt in to disposable localhost SQL tests with ALIFE_TEST_PREPARATION_SQL=1."; }
    }
}
