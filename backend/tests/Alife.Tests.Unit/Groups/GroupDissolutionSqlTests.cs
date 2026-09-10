using Alife.Application.Common.Interfaces;
using Alife.Application.ContentPosts.Services;
using Alife.Application.Groups.Commands.DissolveGroup;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.Groups;

public class GroupDissolutionSqlTests
{
    [LocalSqlTheory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task DissolutionDeletesDependentsAndPreservesAuditUnderRealForeignKeys(bool retainReferencedPolicy)
    {
        // Dedicated disposable database on the repository's local Docker SQL port only.
        var database = "AlifeDissolutionTest_" + Guid.NewGuid().ToString("N");
        var connection = new Microsoft.Data.SqlClient.SqlConnectionStringBuilder
        {
            DataSource = "localhost,14333", InitialCatalog = database, UserID = "sa",
            Password = Environment.GetEnvironmentVariable("ALIFE_LOCAL_SQL_PASSWORD") ?? "AlifeDevPass123",
            TrustServerCertificate = true, Encrypt = false
        };
        await using var db = new AlifeDbContext(new DbContextOptionsBuilder<AlifeDbContext>()
            .UseSqlServer(connection.ConnectionString).UseSnakeCaseNamingConvention().Options);
        try
        {
            await db.Database.EnsureCreatedAsync();
            var leader = new Member { Id = Guid.NewGuid() };
            var former = new Member { Id = Guid.NewGuid() };
            var group = new Group { Id = Guid.NewGuid() };
            var other = new Group { Id = Guid.NewGuid() };
            var category = new ForumCategory { Id = Guid.NewGuid() };
            db.AddRange(leader, former, group, other, category);
            db.GroupMemberships.AddRange(
                new GroupMembership { Id = Guid.NewGuid(), GroupId = group.Id, MemberId = leader.Id, Role = MembershipRole.Leader, Status = MembershipStatus.Approved },
                new GroupMembership { Id = Guid.NewGuid(), GroupId = group.Id, MemberId = former.Id, Status = MembershipStatus.Removed });
            var post = new ForumPost { Id = Guid.NewGuid(), GroupId = group.Id, CategoryId = category.Id, AuthorMemberId = leader.Id };
            db.ForumPosts.Add(post);
            db.ForumComments.Add(new ForumComment { Id = Guid.NewGuid(), PostId = post.Id, AuthorMemberId = former.Id });
            var audit = new AuditLog { Id = Guid.NewGuid(), GroupId = group.Id, ActorMemberId = leader.Id, Action = "original" };
            db.AuditLogs.Add(audit);
            db.FileAssets.Add(new FileAsset { Id = Guid.NewGuid(), GroupId = group.Id, OwnerMemberId = leader.Id, ObjectKey = "test/file.png" });
            if (retainReferencedPolicy)
            {
                var policy = new EventPackageGovernancePolicyVersion { Id = Guid.NewGuid(), OrganisationId = group.Id, PublishedByMemberId = leader.Id };
                var otherEvent = new GroupEvent { Id = Guid.NewGuid(), GroupId = other.Id, CreatedByMemberId = leader.Id, AccountableOwnerMemberId = leader.Id };
                db.EventPackageGovernancePolicyVersions.Add(policy);
                db.GroupEvents.Add(otherEvent);
                db.EventPackages.Add(new EventPackage { Id = Guid.NewGuid(), EventId = otherEvent.Id, GovernancePolicyVersionId = policy.Id, GeneratedByMemberId = leader.Id });
            }
            await db.SaveChangesAsync();
            db.ChangeTracker.Clear();
            var result = await new DissolveGroupCommandHandler(db, Substitute.For<IGroupCacheInvalidationService>(),
                Substitute.For<ICloudflareKvCacheService>(), Substitute.For<IContentPostCacheInvalidationService>())
                .Handle(new(group.Id, leader.Id), default);
            Assert.True(result.IsSuccess, result.Message);
            db.ChangeTracker.Clear();
            Assert.Equal(other.Id, (await db.Groups.SingleAsync()).Id);
            Assert.Empty(await db.GroupMemberships.ToListAsync());
            Assert.Empty(await db.ForumPosts.IgnoreQueryFilters().ToListAsync());
            Assert.Empty(await db.ForumComments.IgnoreQueryFilters().ToListAsync());
            Assert.Null((await db.AuditLogs.SingleAsync(x => x.Id == audit.Id)).GroupId);
            Assert.Equal(2, await db.Members.CountAsync());
            Assert.True((await db.FileAssets.IgnoreQueryFilters().SingleAsync()).IsDeleted);
            Assert.Equal(retainReferencedPolicy, await db.Groups.IgnoreQueryFilters().AnyAsync(x => x.Id == group.Id && x.IsDissolved));
            Assert.Equal(retainReferencedPolicy ? 1 : 0, await db.EventPackages.CountAsync());
        }
        finally
        {
            if (connection.DataSource != "localhost,14333" || !database.StartsWith("AlifeDissolutionTest_"))
                throw new InvalidOperationException("Refusing cleanup outside the disposable test database.");
            await db.Database.EnsureDeletedAsync();
        }
    }

    private sealed class LocalSqlTheoryAttribute : TheoryAttribute
    {
        public LocalSqlTheoryAttribute()
        {
            if (Environment.GetEnvironmentVariable("ALIFE_TEST_GROUP_DISSOLUTION_SQL") != "1")
                Skip = "Opt in with ALIFE_TEST_GROUP_DISSOLUTION_SQL=1; uses a disposable local Docker SQL database.";
        }
    }
}
