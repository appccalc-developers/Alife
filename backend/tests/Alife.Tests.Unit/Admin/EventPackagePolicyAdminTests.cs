using System.Text.Json;
using Alife.Application.Admin;
using Alife.Application.Admin.EventPackagePolicies;
using Alife.Application.Common.Models;
using Alife.Application.Events.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.Admin;

public sealed class EventPackagePolicyAdminTests
{
    [Fact]
    public async Task Publish_RequiresDedicatedPermissionAndRejectsUnknownPolicyProperties()
    {
        await using var db = CreateDb();
        var unprivileged = await SeedActor(db, []);
        var privileged = await SeedActor(db, [AdminPermissionCatalog.ManageEventPackagePolicies], 9102);
        var handler = Handler(db);

        var forbidden = await handler.Handle(new(unprivileged, Request(Rules()), "forbidden"), default);
        var invalid = await handler.Handle(new(privileged, Request(Rules("\"unexpected\":true,")), "invalid"), default);

        Assert.Equal(AppResultStatus.Forbidden, forbidden.Status);
        Assert.Equal(AppResultStatus.ValidationError, invalid.Status);
        Assert.Empty(db.EventPackageGovernancePolicyVersions);
    }

    [Fact]
    public async Task Publish_IsImmutableIdempotentAndRetiresThePriorEffectiveVersion()
    {
        await using var db = CreateDb();
        var actor = await SeedActor(db, [AdminPermissionCatalog.ManageEventPackagePolicies]);
        var old = new EventPackageGovernancePolicyVersion
        {
            Id = Guid.NewGuid(), Version = "2026.1", SchemaVersion = "1", RulesJson = Rules(),
            EnforcementMode = EventPackageEnforcementMode.DryRun, EffectiveFromUtc = DateTime.UtcNow.AddDays(-10),
            IsPublished = true, PublishedByMemberId = actor, PublishedUtc = DateTime.UtcNow.AddDays(-10)
        };
        db.EventPackageGovernancePolicyVersions.Add(old);
        await db.SaveChangesAsync();
        var handler = Handler(db);
        var command = new PublishEventPackagePolicyCommand(actor, Request(Rules()) with { Version = "2026.2" }, "publish-policy");

        var published = await handler.Handle(command, default);
        var replay = await handler.Handle(command, default);

        Assert.True(published.IsSuccess, published.Message);
        Assert.Equal(published.Value!.Id, replay.Value!.Id);
        Assert.NotNull(old.RetiredUtc);
        Assert.Equal(EventPackageEnforcementMode.Enforced, published.Value.EnforcementMode);
        Assert.Equal(2, await db.EventPackageGovernancePolicyVersions.CountAsync());
        Assert.Equal(1, await db.AuditLogs.CountAsync(x => x.Action == "event.package.policy.published"));
    }

    [Fact]
    public async Task RolloutReport_AggregatesDryRunReasonsWithoutExposingAuditPayloads()
    {
        await using var db = CreateDb();
        var actor = await SeedActor(db, [AdminPermissionCatalog.ManageEventPackagePolicies]);
        var eventId = Guid.NewGuid();
        db.AuditLogs.AddRange(
            new AuditLog
            {
                Id = Guid.NewGuid(), EventId = eventId, Action = "event.published",
                EntityType = "GroupEvent", EntityId = eventId, BeforeJson = "{}", AfterJson = "{}",
                MetadataJson = "{\"dryRunReasonCodes\":[\"event.publish.packageMissing\"]}",
                OccurredUtc = DateTime.UtcNow
            },
            new AuditLog
            {
                Id = Guid.NewGuid(), EventId = Guid.NewGuid(), Action = "event.registration.opened",
                EntityType = "GroupEvent", EntityId = Guid.NewGuid(), BeforeJson = "{}", AfterJson = "{}",
                MetadataJson = "{\"dryRunReasonCodes\":[]}", OccurredUtc = DateTime.UtcNow
            });
        await db.SaveChangesAsync();

        var result = await new GetEventPackageRolloutReportQueryHandler(db)
            .Handle(new(actor, 30), default);

        Assert.True(result.IsSuccess, result.Message);
        Assert.Equal(2, result.Value!.EvaluatedOperationCount);
        Assert.Equal(1, result.Value.WouldBlockOperationCount);
        Assert.Equal(1, result.Value.AffectedEventCount);
        Assert.Contains(result.Value.Reasons,
            x => x.ReasonCode == "event.publish.packageMissing" && x.Count == 1);
    }

    private static PublishEventPackagePolicyCommandHandler Handler(AlifeDbContext db)
        => new(db, new EventPackageInvalidationService(db), Substitute.For<IEventCacheInvalidationService>());

    private static PublishEventPackagePolicyRequest Request(string rules)
    {
        using var document = JsonDocument.Parse(rules);
        return new(null, "2026.1", "1", document.RootElement.Clone(),
            EventPackageEnforcementMode.Enforced, DateTime.UtcNow);
    }

    private static string Rules(string extra = "") => "{" + extra +
        "\"schemaVersion\":\"1\",\"preEventConfirmationWindowHours\":72," +
        "\"tierRules\":[" + Tier("light") + "," + Tier("standard") + "," + Tier("enhanced") + "]," +
        "\"authorityByTier\":{\"light\":{\"minimumApproverCount\":1},\"standard\":{\"minimumApproverCount\":1},\"enhanced\":{\"minimumApproverCount\":1}}," +
        "\"approvalValidityByTier\":{\"light\":\"P30D\",\"standard\":\"P14D\",\"enhanced\":\"P7D\"}," +
        "\"materialChangeRules\":[],\"conditionWaiverAllowed\":false,\"delegationRules\":{\"enabled\":false}," +
        "\"legacyRollout\":{\"effectiveFromUtc\":\"2026-09-01T00:00:00Z\",\"transitionDeadlineUtc\":\"2026-12-01T00:00:00Z\",\"cohortRule\":\"new-events-first\",\"safetyCriticalModuleCodes\":[],\"transitionByMode\":{}}}";

    private static string Tier(string tier)
        => $"{{\"tier\":\"{tier}\",\"whenAnyConfirmedFactCodes\":[],\"whenAnyActivityTypeCodes\":[],\"whenAnyModuleCodes\":[]}}";

    private static async Task<Guid> SeedActor(AlifeDbContext db, IReadOnlyList<string> permissions, int roleId = 9101)
    {
        var actor = Guid.NewGuid();
        db.Members.Add(new Member { Id = actor, DisplayName = "Policy admin", IsRegistered = true,
            CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow });
        db.PlatformRoles.Add(new PlatformRole { Id = roleId, Code = $"policy_admin_{roleId}", NameJson = "{}",
            PermissionsJson = AdminPermissionCatalog.WritePermissions(permissions), Level = 50 });
        db.MemberPlatformRoles.Add(new MemberPlatformRole { Id = Guid.NewGuid(), MemberId = actor, RoleId = roleId,
            AssignedByMemberId = actor, AssignedUtc = DateTime.UtcNow });
        await db.SaveChangesAsync();
        return actor;
    }

    private static AlifeDbContext CreateDb() => new(new DbContextOptionsBuilder<AlifeDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString("N")).Options);
}
