using System.Text.Json;
using Alife.Api.Controllers;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Alife.Infrastructure.ReadServices;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Hybrid;
using Microsoft.Extensions.DependencyInjection;
using NSubstitute;

namespace Alife.Tests.Unit.Events;

public sealed class EventPackageFoundationTests
{
    [Fact]
    public void Canonicalizer_SortsPropertiesAndProducesStableHash()
    {
        using var first = JsonDocument.Parse("{\"z\":1,\"a\":{\"y\":2,\"b\":3},\"items\":[{\"q\":1,\"a\":2}]}");
        using var second = JsonDocument.Parse("{\"items\":[{\"a\":2,\"q\":1}],\"a\":{\"b\":3,\"y\":2},\"z\":1}");

        Assert.Equal(EventPackageCanonicalizer.Serialize(first.RootElement), EventPackageCanonicalizer.Serialize(second.RootElement));
        Assert.Equal(EventPackageCanonicalizer.HashCanonical(first.RootElement), EventPackageCanonicalizer.HashCanonical(second.RootElement));
    }

    [Fact]
    public void GateEvaluator_FailsClosedWithDistinctExpiredConditionReason()
    {
        var package = new EventPackage
        {
            Status = EventPackageStatus.ApprovedWithConditions,
            ApprovalValidityStatus = EventPackageApprovalValidity.Active,
            Decisions =
            [
                new EventPackageDecision
                {
                    DecisionType = EventPackageDecisionType.ApproveWithConditions,
                    DecidedUtc = DateTime.UtcNow.AddDays(-1),
                    EffectiveUtc = DateTime.UtcNow.AddDays(-1)
                }
            ],
            Conditions =
            [
                new EventPackageCondition
                {
                    AppliesToGate = EventLifecycleGate.Publish,
                    Status = EventPackageConditionStatus.Open,
                    DueUtc = DateTime.UtcNow.AddMinutes(-1)
                }
            ]
        };

        var result = EventPackageGateEvaluator.Evaluate(
            EventLifecycleGate.Publish, EventPackageEnforcementMode.Enforced, package, DateTime.UtcNow);

        Assert.False(result.Allowed);
        Assert.False(result.RequirementsSatisfied);
        Assert.Contains("event.publish.conditionExpired", result.ReasonCodes);
        Assert.DoesNotContain("event.publish.conditionOpen", result.ReasonCodes);
    }

    [Fact]
    public void GovernanceEventDataHash_IgnoresPresentationOnlyFieldsButNotCapacity()
    {
        const string original = "{\"title\":{\"en\":\"Old\"},\"posterImageUrl\":\"old.jpg\",\"maxCapacity\":40,\"visibility\":\"public\"}";
        const string cosmetic = "{\"title\":{\"en\":\"New\"},\"posterImageUrl\":\"new.jpg\",\"maxCapacity\":40,\"visibility\":\"public\"}";
        const string material = "{\"title\":{\"en\":\"New\"},\"posterImageUrl\":\"new.jpg\",\"maxCapacity\":80,\"visibility\":\"public\"}";

        Assert.Equal(EventPackageCanonicalizer.HashGovernanceEventData(original),
            EventPackageCanonicalizer.HashGovernanceEventData(cosmetic));
        Assert.NotEqual(EventPackageCanonicalizer.HashGovernanceEventData(original),
            EventPackageCanonicalizer.HashGovernanceEventData(material));
    }

    [Fact]
    public async Task Generate_IsDeterministicImmutableAndIdempotent()
    {
        await using var db = CreateDb();
        var seeded = await SeedAsync(db, series: false, modules: ["TEAM.WORK", "PEOPLE.REGISTRATION"]);
        var service = new EventPackageService(db, Authorization());
        var request = new GenerateEventPackageRequest();

        var first = await service.GenerateAsync(seeded.Event.Id, seeded.Owner, request, seeded.Plan.ETag, "package-1", default);
        var retry = await service.GenerateAsync(seeded.Event.Id, seeded.Owner, request, seeded.Plan.ETag, "package-1", default);
        var second = await service.GenerateAsync(seeded.Event.Id, seeded.Owner, request, seeded.Plan.ETag, "package-2", default);

        Assert.True(first.IsSuccess, first.Message);
        Assert.Equal(first.Value!.Id, retry.Value!.Id);
        Assert.NotEqual(first.Value.Id, second.Value!.Id);
        Assert.Equal(first.Value.ContentHash, second.Value.ContentHash);
        Assert.Equal(first.Value.SourceVectorHash, second.Value.SourceVectorHash);
        Assert.Equal(2, await db.EventPackages.CountAsync());
        Assert.Equal(first.Value.Id, second.Value.SupersedesPackageId);
        Assert.Equal(EventGovernanceTier.Standard, first.Value.GovernanceTier);
        Assert.Equal(new[]
        {
            "overview", "structure", "peoplePlaceResources", "safetySafeguarding",
            "registrationFinancePrivacyComms", "specialistDecisions", "readinessChanges"
        }, first.Value.Manifest.Sections.Select(x => x.Code));
        Assert.NotEmpty(first.Value.Manifest.TriggerReasons);
        Assert.Contains(first.Value.Manifest.TriggerReasons, x => x.Code == "event.governance.policyTier");
        Assert.Contains("sponsorshipWhenPolicyRequires", first.Value.Manifest.RequiredSpecialistDecisions);
        Assert.All(first.Value.Manifest.Sections, section =>
        {
            Assert.False(string.IsNullOrWhiteSpace(section.Title.En));
            Assert.False(string.IsNullOrWhiteSpace(section.Title.Zh));
        });
        Assert.DoesNotContain(seeded.Owner.ToString(), JsonSerializer.Serialize(first.Value.Manifest), StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Generate_ProjectsAuthoritativeModuleReadinessWithoutBlockingSpecialistWorkDuringReview()
    {
        await using var db = CreateDb();
        var seeded = await SeedAsync(db, series: false, modules: ["TEAM.WORK", "PLACE.RESOURCE"]);
        var service = new EventPackageService(db, Authorization());

        var generated = await service.GenerateAsync(
            seeded.Event.Id, seeded.Owner, new(), seeded.Plan.ETag, "readiness-generate", default);

        Assert.True(generated.IsSuccess, generated.Message);
        var venue = Assert.Single(generated.Value!.Manifest.Modules, x => x.ModuleCode == "PLACE.RESOURCE");
        Assert.Contains(venue.Blockers, x => x.En.Contains("confirmed venue reservation", StringComparison.Ordinal));
        Assert.Empty(generated.Value.Manifest.Blockers);

        var submitted = await service.SubmitAsync(
            seeded.Event.Id, generated.Value.Id, seeded.Owner, generated.Value.ETag, "readiness-submit", default);
        Assert.True(submitted.IsSuccess, submitted.Message);
    }

    [Fact]
    public async Task PackageHistory_IsPagedFilteredAndDeterministicallySorted()
    {
        await using var db = CreateDb();
        var seeded = await SeedAsync(db, series: false, modules: ["TEAM.WORK"]);
        var service = new EventPackageService(db, Authorization());
        for (var index = 1; index <= 3; index++)
            Assert.True((await service.GenerateAsync(seeded.Event.Id, seeded.Owner, new(), seeded.Plan.ETag,
                $"history-{index}", default)).IsSuccess);

        var page = await service.ListAsync(seeded.Event.Id, seeded.Owner,
            new(Page: 2, PageSize: 1, Status: EventPackageStatus.Draft,
                ScopeType: EventPackageScopeType.Event, Sort: "versionDesc"), default);

        Assert.True(page.IsSuccess, page.Message);
        Assert.Equal(3, page.Value!.TotalCount);
        Assert.Equal(2, page.Value.Page);
        Assert.Equal(2, page.Value.Items.Single().Version);
        Assert.True((await service.GenerateAsync(seeded.Event.Id, seeded.Owner,
            new(EventPackageScopeType.Occurrence, seeded.Occurrences[0].Id), seeded.Plan.ETag,
            "history-occurrence", default)).IsSuccess);
        var occurrencePage = await service.ListAsync(seeded.Event.Id, seeded.Owner,
            new(ScopeType: EventPackageScopeType.Occurrence, ScopeId: seeded.Occurrences[0].Id), default);
        Assert.Equal(1, occurrencePage.Value!.TotalCount);
        Assert.Equal(seeded.Occurrences[0].Id, occurrencePage.Value.Items.Single().ScopeId);
        Assert.Equal(AppResultStatus.ValidationError, (await service.ListAsync(seeded.Event.Id, seeded.Owner,
            new(PageSize: 101), default)).Status);
        Assert.Equal(AppResultStatus.ValidationError, (await service.ListAsync(seeded.Event.Id, seeded.Owner,
            new(ScopeId: seeded.Occurrences[0].Id), default)).Status);
    }

    [Fact]
    public async Task Generate_UsesOccurrenceAndSeriesWindowScopes_WhileChildEventRemainsIndependent()
    {
        await using var db = CreateDb();
        var parent = await SeedAsync(db, series: true, modules: ["TEAM.WORK"]);
        var service = new EventPackageService(db, Authorization());
        var eventPackage = await service.GenerateAsync(parent.Event.Id, parent.Owner, new(), parent.Plan.ETag, "series", default);
        var occurrencePackage = await service.GenerateAsync(parent.Event.Id, parent.Owner,
            new(EventPackageScopeType.Occurrence, parent.Occurrences[1].Id), parent.Plan.ETag, "occurrence", default);

        Assert.True(eventPackage.IsSuccess, eventPackage.Message);
        Assert.Equal(EventPackageCoverageMode.PlanBoundSeriesWindow, eventPackage.Value!.CoverageMode);
        Assert.Equal(parent.Occurrences.Select(x => x.Id), eventPackage.Value.CoveredOccurrenceIds);
        Assert.Equal(EventPackageCoverageMode.ExplicitOccurrences, occurrencePackage.Value!.CoverageMode);
        Assert.Equal([parent.Occurrences[1].Id], occurrencePackage.Value.CoveredOccurrenceIds);

        var child = await SeedAsync(db, series: false, modules: ["TEAM.WORK"], parent.Event.Id);
        var childPackage = await service.GenerateAsync(child.Event.Id, child.Owner, new(), child.Plan.ETag, "child", default);
        Assert.Equal(child.Event.Id, childPackage.Value!.EventId);
        Assert.Equal([child.Occurrences[0].Id], childPackage.Value.CoveredOccurrenceIds);
    }

    [Fact]
    public async Task PackageEndpoints_AreNoStoreAndUnauthorizedViewersCannotRead()
    {
        await using var db = CreateDb();
        var seeded = await SeedAsync(db, series: false, modules: ["TEAM.WORK"]);
        var outsider = Guid.NewGuid();
        var ordinaryGroupMember = Guid.NewGuid();
        var ordinaryTeamMember = Guid.NewGuid();
        db.Members.AddRange(
            new Member { Id = ordinaryGroupMember, DisplayName = "Ordinary group member", IsRegistered = true, CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow },
            new Member { Id = ordinaryTeamMember, DisplayName = "Ordinary Event Team member", IsRegistered = true, CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow });
        db.GroupMemberships.Add(new GroupMembership
        {
            Id = Guid.NewGuid(), GroupId = seeded.Event.GroupId, MemberId = ordinaryGroupMember,
            Status = MembershipStatus.Approved, Role = MembershipRole.Member,
            CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
        });
        db.EventTeamMembers.Add(new EventTeamMember
        {
            Id = Guid.NewGuid(), EventId = seeded.Event.Id, MemberId = ordinaryTeamMember,
            InvitedByMemberId = seeded.Owner, Status = EventTeamMemberStatus.Accepted,
            JoinedUtc = DateTime.UtcNow, CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
        var auth = Authorization();
        var service = new EventPackageService(db, auth);
        Assert.Equal(AppResultStatus.Forbidden,
            (await service.ListAsync(seeded.Event.Id, outsider, new(), default)).Status);
        Assert.Equal(AppResultStatus.Forbidden,
            (await service.ListAsync(seeded.Event.Id, ordinaryGroupMember, new(), default)).Status);
        var generated = await service.GenerateAsync(
            seeded.Event.Id, seeded.Owner, new(), seeded.Plan.ETag, "role-matrix-generate", default);
        Assert.True((await service.ListAsync(seeded.Event.Id, ordinaryTeamMember, new(), default)).IsSuccess);
        var teamCapabilities = await service.GetCapabilitiesAsync(
            seeded.Event.Id, generated.Value!.Id, ordinaryTeamMember, default);
        Assert.False(teamCapabilities.Value!.CanGenerate);
        Assert.False(teamCapabilities.Value.CanSubmit);
        Assert.False(teamCapabilities.Value.CanDecide);

        var accessor = Substitute.For<ICurrentMemberAccessor>();
        accessor.GetCurrentMemberId().Returns(seeded.Owner);
        var controller = new EventPackagesController(service, accessor)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };
        var result = await controller.List(seeded.Event.Id, ct: default);
        Assert.IsType<OkObjectResult>(result);
        Assert.Equal("private, no-store", controller.Response.Headers.CacheControl.ToString());
        Assert.Equal("no-cache", controller.Response.Headers.Pragma.ToString());
        Assert.Contains("Cookie", controller.Response.Headers.Vary.ToString());
        Assert.Contains("Authorization", controller.Response.Headers.Vary.ToString());
    }

    [Fact]
    public async Task LifecycleProjection_UsesCurrentPolicyAndPackageWithBilingualActionableBlockers()
    {
        await using var db = CreateDb();
        var seeded = await SeedAsync(db, series: false, modules: ["TEAM.WORK"]);
        (await db.EventPackageGovernancePolicyVersions.SingleAsync()).EnforcementMode = EventPackageEnforcementMode.Enforced;
        await db.SaveChangesAsync();
        var service = new EventPackageService(db, Authorization());
        var generated = await service.GenerateAsync(
            seeded.Event.Id, seeded.Owner, new(), seeded.Plan.ETag, "gate-projection", default);
        Assert.True(generated.IsSuccess, generated.Message);

        var lifecycle = await service.GetLifecycleAsync(seeded.Event.Id, seeded.Owner, default);

        Assert.True(lifecycle.IsSuccess, lifecycle.Message);
        Assert.Equal(EventPackageEnforcementMode.Enforced, lifecycle.Value!.GateMode);
        Assert.False(lifecycle.Value.PublishGateSatisfied);
        var publish = Assert.Single(lifecycle.Value.Gates, x => x.Gate == EventLifecycleGate.Publish);
        Assert.Equal(generated.Value!.Version, publish.EventPackageVersion);
        var approvalBlocker = Assert.Single(publish.Blockers,
            x => x.Code == "event.publish.packageNotApproved");
        Assert.False(string.IsNullOrWhiteSpace(approvalBlocker.Message.En));
        Assert.False(string.IsNullOrWhiteSpace(approvalBlocker.Message.Zh));
        Assert.False(string.IsNullOrWhiteSpace(approvalBlocker.ResponsibleRole));
        Assert.False(string.IsNullOrWhiteSpace(approvalBlocker.NextAction));
        Assert.False(lifecycle.Value.PaymentGateSatisfied);
        Assert.Contains("event.payment.capabilityUnavailable", lifecycle.Value.PaymentReasonCodes);
    }

    [Fact]
    public async Task Generate_RejectsStalePlanAndChangesHashWhenAnAuthoritativeSourceChanges()
    {
        await using var db = CreateDb();
        var seeded = await SeedAsync(db, series: false, modules: ["TEAM.WORK"]);
        var service = new EventPackageService(db, Authorization());

        var stale = await service.GenerateAsync(seeded.Event.Id, seeded.Owner, new(), "\"old-plan\"", "stale", default);
        Assert.Equal(AppResultStatus.PreconditionFailed, stale.Status);
        Assert.Empty(await db.EventPackages.ToListAsync());

        var first = await service.GenerateAsync(seeded.Event.Id, seeded.Owner, new(), seeded.Plan.ETag, "before-task", default);
        db.EventTasks.Add(new EventTask
        {
            Id = Guid.NewGuid(), EventId = seeded.Event.Id, TitleEn = "Confirm host", TitleZh = "确认负责人",
            Status = EventTaskStatus.Todo, IsRequired = true, CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
        var second = await service.GenerateAsync(seeded.Event.Id, seeded.Owner, new(), seeded.Plan.ETag, "after-task", default);

        Assert.True(first.IsSuccess, first.Message);
        Assert.True(second.IsSuccess, second.Message);
        Assert.NotEqual(first.Value!.SourceVectorHash, second.Value!.SourceVectorHash);
        Assert.NotEqual(first.Value.ContentHash, second.Value.ContentHash);
    }

    [Fact]
    public async Task RegistrationParticipantChanges_DoNotChangeTheGovernanceSourceVector()
    {
        await using var db = CreateDb();
        var seeded = await SeedAsync(db, series: false, modules: ["TEAM.WORK", "PEOPLE.REGISTRATION"]);
        var service = new EventPackageService(db, Authorization());
        var before = await service.GenerateAsync(seeded.Event.Id, seeded.Owner, new(), seeded.Plan.ETag,
            "registration-source-before", default);
        db.EventEnrollments.Add(new EventEnrollment
        {
            Id = Guid.NewGuid(), GroupId = seeded.Event.GroupId, EventId = seeded.Event.Id,
            MemberId = Guid.NewGuid(), EnrollmentJson = "{}",
            CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
        var after = await service.GenerateAsync(seeded.Event.Id, seeded.Owner, new(), seeded.Plan.ETag,
            "registration-source-after", default);

        Assert.Equal(before.Value!.SourceVectorHash, after.Value!.SourceVectorHash);
        Assert.Equal(before.Value.ContentHash, after.Value.ContentHash);
    }

    [Fact]
    public async Task Diff_ExplainsCosmeticAndGovernanceCriticalChangesWithoutSourcePayloads()
    {
        await using var db = CreateDb();
        var seeded = await SeedAsync(db, series: false, modules: ["TEAM.WORK"]);
        var service = new EventPackageService(db, Authorization());
        var first = await service.GenerateAsync(seeded.Event.Id, seeded.Owner, new(), seeded.Plan.ETag, "diff-before", default);
        seeded.Event.TitleEn = "Updated event title";
        seeded.Event.StartDate = seeded.Event.StartDate.AddHours(1);
        await db.SaveChangesAsync();
        var second = await service.GenerateAsync(seeded.Event.Id, seeded.Owner, new(), seeded.Plan.ETag, "diff-after", default);

        var diff = await service.DiffAsync(seeded.Event.Id, first.Value!.Id, second.Value!.Id, seeded.Owner, default);

        Assert.True(diff.IsSuccess, diff.Message);
        Assert.True(diff.Value!.HasMaterialChanges);
        Assert.Contains(diff.Value.Changes, x => x.Field == "eventTitle.en" && x.Classification == "cosmetic");
        Assert.Contains(diff.Value.Changes, x => x.Field == "startUtc" && x.Classification == "governanceCritical");
        Assert.DoesNotContain("EventDataJson", JsonSerializer.Serialize(diff.Value), StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task LegacyPlan_RolloutAndRollbackClassifyWithoutInventingOrReactivatingApproval()
    {
        await using var db = CreateDb();
        var seeded = await SeedAsync(db, series: false, modules: ["TEAM.WORK"], legacy: true);
        var service = new EventPackageService(db, Authorization());
        var policy = await db.EventPackageGovernancePolicyVersions.SingleAsync();
        var off = await service.GenerateAsync(
            seeded.Event.Id, seeded.Owner, new(), seeded.Plan.ETag, "legacy", default);

        Assert.True(off.IsSuccess, off.Message);
        Assert.Equal(LegacyEventPackageTransition.LegacyReadOnlyPackage, off.Value!.Manifest.LegacyTransition);
        policy.EnforcementMode = EventPackageEnforcementMode.DryRun;
        await db.SaveChangesAsync();
        var dryRun = await service.GenerateAsync(
            seeded.Event.Id, seeded.Owner, new(), seeded.Plan.ETag, "legacy-dry-run", default);
        Assert.Equal(LegacyEventPackageTransition.TimeLimitedCompatibility, dryRun.Value!.Manifest.LegacyTransition);
        policy.EnforcementMode = EventPackageEnforcementMode.Enforced;
        await db.SaveChangesAsync();
        var enforced = await service.GenerateAsync(
            seeded.Event.Id, seeded.Owner, new(), seeded.Plan.ETag, "legacy-enforced", default);
        Assert.Equal(LegacyEventPackageTransition.FormalPackageRequired, enforced.Value!.Manifest.LegacyTransition);
        Assert.Equal(EventPackageApprovalValidity.NotDecided, enforced.Value.ApprovalValidityStatus);
        var storedEnforced = await db.EventPackages.SingleAsync(x => x.Id == enforced.Value.Id);
        storedEnforced.ApprovalValidityStatus = EventPackageApprovalValidity.Invalidated;
        policy.EnforcementMode = EventPackageEnforcementMode.Off;
        await db.SaveChangesAsync();
        var rolledBack = await service.GenerateAsync(
            seeded.Event.Id, seeded.Owner, new(), seeded.Plan.ETag, "legacy-rollback", default);

        Assert.Equal(LegacyEventPackageTransition.LegacyReadOnlyPackage, rolledBack.Value!.Manifest.LegacyTransition);
        Assert.Equal(EventPackageApprovalValidity.Invalidated, storedEnforced.ApprovalValidityStatus);
        Assert.All(new[] { off.Value, dryRun.Value, rolledBack.Value }, item =>
        {
            Assert.Equal(EventPackageStatus.Draft, item.Status);
            Assert.Equal(EventPackageApprovalValidity.NotDecided, item.ApprovalValidityStatus);
        });
    }

    [Fact]
    public async Task StandardPackage_RequiresFreshSourcesAndSeparatedGroupLeaderApproval()
    {
        await using var db = CreateDb();
        var seeded = await SeedAsync(db, series: false, modules: ["TEAM.WORK", "PEOPLE.REGISTRATION"]);
        var leader = Guid.NewGuid();
        db.GroupMemberships.Add(new GroupMembership
        {
            Id = Guid.NewGuid(), GroupId = seeded.Event.GroupId, MemberId = leader,
            Status = MembershipStatus.Approved, Role = MembershipRole.Leader,
            CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
        });
        (await db.EventPackageGovernancePolicyVersions.SingleAsync()).EnforcementMode = EventPackageEnforcementMode.Enforced;
        db.EventRamAssessments.Add(new EventRamAssessment
        {
            EventId = seeded.Event.Id, Status = EventRamStatus.Approved, RamDataJson = "{}",
            ApprovedByMemberId = leader, ApprovedUtc = DateTime.UtcNow,
            CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
        var service = new EventPackageService(db, Authorization());
        var generated = await service.GenerateAsync(seeded.Event.Id, seeded.Owner, new(), seeded.Plan.ETag, "generate", default);

        var submitted = await service.SubmitAsync(seeded.Event.Id, generated.Value!.Id, seeded.Owner,
            generated.Value.ETag, "submit", default);
        Assert.True(submitted.IsSuccess, submitted.Message);
        Assert.Equal(EventPackageStatus.Submitted, submitted.Value!.Status);

        var selfDecision = await service.DecideAsync(seeded.Event.Id, submitted.Value.Id, seeded.Owner,
            new(EventPackageDecisionType.Approve, new("Owner approves", "负责人批准")), submitted.Value.ETag, "owner-decision", default);
        Assert.Equal(AppResultStatus.Forbidden, selfDecision.Status);

        var approved = await service.DecideAsync(seeded.Event.Id, submitted.Value.Id, leader,
            new(EventPackageDecisionType.Approve, new("Ready to proceed", "可以继续推进")), submitted.Value.ETag, "leader-decision", default);
        var retry = await service.DecideAsync(seeded.Event.Id, submitted.Value.Id, leader,
            new(EventPackageDecisionType.Approve, new("Ready to proceed", "可以继续推进")), submitted.Value.ETag, "leader-decision", default);

        Assert.True(approved.IsSuccess, approved.Message);
        Assert.Equal(approved.Value!.Id, retry.Value!.Id);
        Assert.Equal(EventPackageStatus.Approved, approved.Value.Status);
        Assert.Equal(EventPackageApprovalValidity.Active, approved.Value.ApprovalValidityStatus);
        Assert.Single(approved.Value.Decisions);
        Assert.Equal(leader, approved.Value.Decisions[0].ActorMemberId);
        Assert.Equal(2, await db.AuditLogs.CountAsync(x => x.EventId == seeded.Event.Id && x.EntityType == "EventPackage"));
        Assert.Contains(await db.NotificationMessages.AsNoTracking().ToListAsync(),
            x => x.RecipientMemberId == leader && x.ActionType == "event.package.submitted");
        Assert.Contains(await db.NotificationMessages.AsNoTracking().ToListAsync(),
            x => x.RecipientMemberId == seeded.Owner && x.ActionType == "event.package.decided");
        Assert.Equal(2, await db.NotificationMessages.CountAsync());

        var lifecycle = await service.GetLifecycleAsync(seeded.Event.Id, seeded.Owner, default);
        var published = await service.PublishAsync(seeded.Event.Id, seeded.Owner,
            new(approved.Value.Id, approved.Value.ETag, lifecycle.Value!.ETag), "publish-standard", default);
        Assert.True(published.IsSuccess, published.Message);
        Assert.Equal(EventPublicationStatus.Published, published.Value!.PublicationStatus);
    }

    [Fact]
    public async Task StandardPackage_AllowsOnlyActivePolicyEnabledScopedDelegationAndRevocationIsImmediate()
    {
        await using var db = CreateDb();
        var seeded = await SeedAsync(db, series: false, modules: ["TEAM.WORK", "PEOPLE.REGISTRATION"]);
        var policy = await db.EventPackageGovernancePolicyVersions.SingleAsync();
        policy.RulesJson = policy.RulesJson.Replace("\"enabled\":false", "\"enabled\":true,\"allowedTiers\":[\"standard\"]", StringComparison.Ordinal);
        var leader = Guid.NewGuid(); var delegatedApprover = Guid.NewGuid();
        db.Groups.Add(new Group { Id = seeded.Event.GroupId, NameJson = "{}", CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow });
        db.Members.AddRange(
            new Member { Id = leader, DisplayName = "Leader", IsRegistered = true, CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow },
            new Member { Id = delegatedApprover, DisplayName = "Delegate", IsRegistered = true, CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow });
        db.GroupMemberships.AddRange(
            new GroupMembership { Id = Guid.NewGuid(), GroupId = seeded.Event.GroupId, MemberId = leader,
                Role = MembershipRole.Leader, Status = MembershipStatus.Approved, CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow },
            new GroupMembership { Id = Guid.NewGuid(), GroupId = seeded.Event.GroupId, MemberId = delegatedApprover,
                Role = MembershipRole.Member, Status = MembershipStatus.Approved, CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow });
        await db.SaveChangesAsync();
        var delegations = new EventPackageDelegationService(db);
        var granted = await delegations.GrantAsync(leader, new(seeded.Event.GroupId,
            EventPackageDelegationScopeType.Organisation, null, "event.package.decide", delegatedApprover,
            DateTime.UtcNow.AddMinutes(-1), DateTime.UtcNow.AddDays(7)), "grant", default);
        Assert.True(granted.IsSuccess, granted.Message);

        var packages = new EventPackageService(db, Authorization());
        var first = await packages.GenerateAsync(seeded.Event.Id, seeded.Owner, new(), seeded.Plan.ETag, "delegated-generate", default);
        var submitted = await packages.SubmitAsync(seeded.Event.Id, first.Value!.Id, seeded.Owner, first.Value.ETag, "delegated-submit", default);
        var approved = await packages.DecideAsync(seeded.Event.Id, first.Value.Id, delegatedApprover,
            new(EventPackageDecisionType.Approve, new("Delegated approval", "委派审批通过")), submitted.Value!.ETag, "delegated-decide", default);
        Assert.True(approved.IsSuccess, approved.Message);
        Assert.NotNull(approved.Value!.Decisions.Single().ExpiresUtc);

        var delegationEntity = await db.EventPackageApprovalDelegations.SingleAsync();
        delegationEntity.ExpiresUtc = DateTime.UtcNow.AddMinutes(-1);
        await db.SaveChangesAsync();
        var expiredPackage = await packages.GenerateAsync(seeded.Event.Id, seeded.Owner, new(), seeded.Plan.ETag, "expired-generate", default);
        var expiredSubmitted = await packages.SubmitAsync(seeded.Event.Id, expiredPackage.Value!.Id, seeded.Owner, expiredPackage.Value.ETag, "expired-submit", default);
        var expiredDenied = await packages.DecideAsync(seeded.Event.Id, expiredPackage.Value.Id, delegatedApprover,
            new(EventPackageDecisionType.Approve, new("Expired delegation", "过期委派")), expiredSubmitted.Value!.ETag, "expired-decide", default);
        Assert.Equal(AppResultStatus.Forbidden, expiredDenied.Status);
        delegationEntity.ExpiresUtc = DateTime.UtcNow.AddDays(7);
        await db.SaveChangesAsync();

        var revoked = await delegations.RevokeAsync(granted.Value!.Id, leader,
            new(new("Delegation no longer required", "不再需要委派")), granted.Value.ETag, "revoke-delegation", default);
        Assert.True(revoked.IsSuccess, revoked.Message);
        var revokeRetry = await delegations.RevokeAsync(granted.Value.Id, leader,
            new(new("Delegation no longer required", "不再需要委派")), granted.Value.ETag, "revoke-delegation", default);
        Assert.True(revokeRetry.IsSuccess, revokeRetry.Message);
        var second = await packages.GenerateAsync(seeded.Event.Id, seeded.Owner, new(), seeded.Plan.ETag, "revoked-generate", default);
        var secondSubmitted = await packages.SubmitAsync(seeded.Event.Id, second.Value!.Id, seeded.Owner, second.Value.ETag, "revoked-submit", default);
        var denied = await packages.DecideAsync(seeded.Event.Id, second.Value.Id, delegatedApprover,
            new(EventPackageDecisionType.Approve, new("Revoked delegation", "已撤销委派")), secondSubmitted.Value!.ETag, "revoked-decide", default);
        Assert.Equal(AppResultStatus.Forbidden, denied.Status);
        Assert.Equal(2, await db.AuditLogs.CountAsync(x => x.EntityType == "EventPackageApprovalDelegation"));
    }

    [Fact]
    public async Task PolicyQuorum_RequiresDistinctApproversAndFailsClosedWhenOneApprovalIsRevoked()
    {
        await using var db = CreateDb();
        var seeded = await SeedAsync(db, series: false, modules: ["TEAM.WORK", "PEOPLE.REGISTRATION"]);
        var policy = await db.EventPackageGovernancePolicyVersions.SingleAsync();
        policy.RulesJson = policy.RulesJson.Replace("\"standard\":{\"minimumApproverCount\":1}",
            "\"standard\":{\"minimumApproverCount\":2}", StringComparison.Ordinal);
        var firstLeader = Guid.NewGuid(); var secondLeader = Guid.NewGuid();
        db.GroupMemberships.AddRange(
            new GroupMembership { Id = Guid.NewGuid(), GroupId = seeded.Event.GroupId, MemberId = firstLeader,
                Role = MembershipRole.Leader, Status = MembershipStatus.Approved, CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow },
            new GroupMembership { Id = Guid.NewGuid(), GroupId = seeded.Event.GroupId, MemberId = secondLeader,
                Role = MembershipRole.CoLeader, Status = MembershipStatus.Approved, CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow });
        await db.SaveChangesAsync();
        var service = new EventPackageService(db, Authorization());
        var generated = await service.GenerateAsync(seeded.Event.Id, seeded.Owner, new(), seeded.Plan.ETag, "quorum-generate", default);
        var submitted = await service.SubmitAsync(seeded.Event.Id, generated.Value!.Id, seeded.Owner, generated.Value.ETag, "quorum-submit", default);

        var first = await service.DecideAsync(seeded.Event.Id, generated.Value.Id, firstLeader,
            new(EventPackageDecisionType.Approve, new("First quorum vote", "第一票批准")), submitted.Value!.ETag, "quorum-first", default);
        Assert.True(first.IsSuccess, first.Message);
        Assert.Equal(EventPackageStatus.Submitted, first.Value!.Status);
        Assert.Equal(EventPackageApprovalValidity.NotDecided, first.Value.ApprovalValidityStatus);
        var duplicate = await service.DecideAsync(seeded.Event.Id, generated.Value.Id, firstLeader,
            new(EventPackageDecisionType.Approve, new("Duplicate vote", "重复投票")), first.Value.ETag, "quorum-duplicate", default);
        Assert.Equal(AppResultStatus.Conflict, duplicate.Status);

        var second = await service.DecideAsync(seeded.Event.Id, generated.Value.Id, secondLeader,
            new(EventPackageDecisionType.Approve, new("Second quorum vote", "第二票批准")), first.Value.ETag, "quorum-second", default);
        Assert.True(second.IsSuccess, second.Message);
        Assert.Equal(EventPackageStatus.Approved, second.Value!.Status);
        Assert.Equal(EventPackageApprovalValidity.Active, second.Value.ApprovalValidityStatus);

        var revoked = await service.RevokeDecisionAsync(seeded.Event.Id, second.Value.Id,
            second.Value.Decisions.Single(x => x.ActorMemberId == secondLeader).Id, firstLeader,
            new(new("Quorum approval withdrawn", "撤回法定票数批准")), second.Value.ETag, "quorum-revoke", default);
        Assert.True(revoked.IsSuccess, revoked.Message);
        Assert.Equal(EventPackageApprovalValidity.Revoked, revoked.Value!.ApprovalValidityStatus);
        Assert.Contains("event.publish.packageNotApproved", EventPackageGateEvaluator.Evaluate(
            EventLifecycleGate.Publish, EventPackageEnforcementMode.Enforced,
            await db.EventPackages.Include(x => x.Decisions).SingleAsync(x => x.Id == revoked.Value.Id), DateTime.UtcNow).ReasonCodes);
    }

    [Fact]
    public async Task Submit_RejectsChangedSourcesAndLeavesDraftUnchanged()
    {
        await using var db = CreateDb();
        var seeded = await SeedAsync(db, series: false, modules: ["TEAM.WORK"]);
        var service = new EventPackageService(db, Authorization());
        var generated = await service.GenerateAsync(seeded.Event.Id, seeded.Owner, new(), seeded.Plan.ETag, "generate", default);
        db.EventTasks.Add(new EventTask
        {
            Id = Guid.NewGuid(), EventId = seeded.Event.Id, TitleEn = "Changed source", TitleZh = "来源已变化",
            Status = EventTaskStatus.Todo, IsRequired = true, CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var submitted = await service.SubmitAsync(seeded.Event.Id, generated.Value!.Id, seeded.Owner,
            generated.Value.ETag, "submit", default);

        Assert.Equal(AppResultStatus.Conflict, submitted.Status);
        Assert.Equal("event.package.sourceChanged", submitted.Message);
        Assert.Equal(EventPackageStatus.Draft, (await db.EventPackages.SingleAsync()).Status);
        Assert.Empty(await db.EventPackageDecisions.ToListAsync());
    }

    [Fact]
    public async Task ConditionalApproval_RequiresStructuredBilingualConditions()
    {
        await using var db = CreateDb();
        var seeded = await SeedAsync(db, series: false, modules: ["TEAM.WORK"]);
        (await db.EventPackageGovernancePolicyVersions.SingleAsync()).EnforcementMode = EventPackageEnforcementMode.Enforced;
        db.EventRamAssessments.Add(new EventRamAssessment
        {
            EventId = seeded.Event.Id, Status = EventRamStatus.Approved, RamDataJson = "{}",
            ApprovedByMemberId = seeded.Owner, ApprovedUtc = DateTime.UtcNow,
            CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
        });
        db.EventRoleAssignments.Add(new EventRoleAssignment
        {
            Id = Guid.NewGuid(), EventId = seeded.Event.Id, MemberId = seeded.Owner,
            RoleRequirementKey = "event:venue.coordinator", ScopeType = "event",
            Status = EventRoleAssignmentStatus.Accepted, AssignedByMemberId = seeded.Owner,
            AcceptedUtc = DateTime.UtcNow, CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
        var service = new EventPackageService(db, Authorization());
        var generated = await service.GenerateAsync(seeded.Event.Id, seeded.Owner, new(), seeded.Plan.ETag, "generate", default);
        var submitted = await service.SubmitAsync(seeded.Event.Id, generated.Value!.Id, seeded.Owner,
            generated.Value.ETag, "submit", default);

        var invalid = await service.DecideAsync(seeded.Event.Id, submitted.Value!.Id, seeded.Owner,
            new(EventPackageDecisionType.ApproveWithConditions, new("Conditional", "附条件")), submitted.Value.ETag, "invalid", default);
        Assert.Equal(AppResultStatus.ValidationError, invalid.Status);

        var approved = await service.DecideAsync(seeded.Event.Id, submitted.Value.Id, seeded.Owner,
            new(EventPackageDecisionType.ApproveWithConditions, new("Conditional", "附条件"), null,
                [new(new("Confirm venue access", "确认场地通行"), EventLifecycleGate.Publish,
                    "event:venue.coordinator", DateTime.UtcNow.AddDays(2))]),
            submitted.Value.ETag, "conditional", default);

        Assert.True(approved.IsSuccess, approved.Message);
        Assert.Equal(EventPackageStatus.ApprovedWithConditions, approved.Value!.Status);
        Assert.Single(approved.Value.Conditions);
        Assert.Equal(EventPackageConditionStatus.Open, approved.Value.Conditions[0].Status);
        Assert.NotNull(approved.Value.Conditions[0].ReadinessTaskId);
        Assert.Equal(EventTaskStatus.Todo,
            (await db.EventTasks.SingleAsync(x => x.Id == approved.Value.Conditions[0].ReadinessTaskId)).Status);

        var lifecycle = await service.GetLifecycleAsync(seeded.Event.Id, seeded.Owner, default);
        var blocked = await service.PublishAsync(seeded.Event.Id, seeded.Owner,
            new(approved.Value.Id, approved.Value.ETag, lifecycle.Value!.ETag), "publish-open-condition", default);
        Assert.Equal("event.publish.conditionOpen", blocked.Message);

        var satisfied = await service.SatisfyConditionAsync(seeded.Event.Id, approved.Value.Id,
            approved.Value.Conditions[0].Id, seeded.Owner, new("event-task://venue-access"),
            approved.Value.Conditions[0].ETag, "satisfy", default);
        Assert.True(satisfied.IsSuccess, satisfied.Message);
        Assert.Equal(EventPackageConditionStatus.EvidenceSubmitted, satisfied.Value!.Condition.Status);
        Assert.Equal("event-task://venue-access", satisfied.Value.Condition.EvidenceReference);
        Assert.NotNull(satisfied.Value.Condition.EvidenceReferenceHash);
        Assert.True(satisfied.Value.Condition.EvidenceExpiresUtc > DateTime.UtcNow);
        Assert.Equal(EventTaskStatus.InProgress,
            (await db.EventTasks.SingleAsync(x => x.Id == satisfied.Value.Condition.ReadinessTaskId)).Status);
        var retainedEvidence = await db.EventPackageConditions.SingleAsync();
        retainedEvidence.EvidenceExpiresUtc = DateTime.UtcNow.AddMinutes(-1);
        await db.SaveChangesAsync();
        var redacted = await service.GetAsync(seeded.Event.Id, approved.Value.Id, seeded.Owner, default);
        var redactedCondition = redacted.Value!.Conditions.Single();
        Assert.False(redactedCondition.EvidenceAvailable);
        Assert.Null(redactedCondition.EvidenceReference);
        Assert.NotNull(redactedCondition.EvidenceReferenceHash);
        Assert.NotNull(redactedCondition.EvidenceUnavailableUtc);
        Assert.Contains(await db.AuditLogs.AsNoTracking().ToListAsync(), audit =>
            audit.Action == "event.package.condition.evidenceMadeUnavailable" &&
            !(audit.BeforeJson ?? string.Empty).Contains("event-task://venue-access", StringComparison.Ordinal) &&
            !(audit.AfterJson ?? string.Empty).Contains("event-task://venue-access", StringComparison.Ordinal));
        var verified = await service.VerifyConditionAsync(seeded.Event.Id, approved.Value.Id,
            approved.Value.Conditions[0].Id, seeded.Owner, new(true, new("Evidence checked", "证据已核验")),
            redactedCondition.ETag, "verify", default);
        Assert.True(verified.IsSuccess, verified.Message);
        Assert.Equal(EventPackageConditionStatus.Verified, verified.Value!.Condition.Status);
        var conditionTask = await db.EventTasks.SingleAsync(x => x.Id == verified.Value.Condition.ReadinessTaskId);
        Assert.Equal(EventTaskStatus.Done, conditionTask.Status);
        Assert.NotNull(conditionTask.CompletedUtc);
        var published = await service.PublishAsync(seeded.Event.Id, seeded.Owner,
            new(approved.Value.Id, approved.Value.ETag, lifecycle.Value.ETag), "publish-verified", default);
        Assert.True(published.IsSuccess, published.Message);
    }

    [Fact]
    public async Task OverdueCondition_IsPersistedAsExpiredAndAuditedOnRead()
    {
        await using var db = CreateDb();
        var seeded = await SeedAsync(db, series: false, modules: ["TEAM.WORK"]);
        var policy = await db.EventPackageGovernancePolicyVersions.SingleAsync();
        policy.EnforcementMode = EventPackageEnforcementMode.Enforced;
        await db.SaveChangesAsync();
        var service = new EventPackageService(db, Authorization());
        var generated = await service.GenerateAsync(seeded.Event.Id, seeded.Owner, new(), seeded.Plan.ETag,
            "expiry-generate", default);
        var submitted = await service.SubmitAsync(seeded.Event.Id, generated.Value!.Id, seeded.Owner,
            generated.Value.ETag, "expiry-submit", default);
        var approved = await service.DecideAsync(seeded.Event.Id, submitted.Value!.Id, seeded.Owner,
            new(EventPackageDecisionType.ApproveWithConditions, new("Conditional", "附条件"), null,
                [new(new("Confirm venue access", "确认场地通行"), EventLifecycleGate.Publish,
                    "event:venue.coordinator", DateTime.UtcNow.AddHours(1))]),
            submitted.Value.ETag, "expiry-approve", default);
        Assert.True(approved.IsSuccess, approved.Message);

        var condition = await db.EventPackageConditions.SingleAsync();
        condition.DueUtc = DateTime.UtcNow.AddMinutes(-1);
        await db.SaveChangesAsync();

        var read = await service.GetAsync(seeded.Event.Id, approved.Value!.Id, seeded.Owner, default);

        Assert.True(read.IsSuccess, read.Message);
        Assert.Equal(EventPackageConditionStatus.Expired, read.Value!.Conditions.Single().Status);
        var persisted = await db.EventPackageConditions.AsNoTracking().SingleAsync();
        Assert.Equal(EventPackageConditionStatus.Expired, persisted.Status);
        Assert.NotNull(persisted.ExpiredUtc);
        Assert.Equal(EventTaskStatus.Blocked,
            (await db.EventTasks.SingleAsync(x => x.Id == persisted.ReadinessTaskId)).Status);
        Assert.Contains(await db.AuditLogs.AsNoTracking().ToListAsync(),
            x => x.Action == "event.package.condition.expired" && x.EntityId == persisted.Id);
    }

    [Fact]
    public async Task ConditionWaiver_RequiresPolicyDedicatedEndpointAndIndependentAuthority()
    {
        await using var db = CreateDb();
        var seeded = await SeedAsync(db, series: false, modules: ["TEAM.WORK"]);
        var secondLeader = Guid.NewGuid();
        db.GroupMemberships.Add(new GroupMembership
        {
            Id = Guid.NewGuid(), GroupId = seeded.Event.GroupId, MemberId = secondLeader,
            Status = MembershipStatus.Approved, Role = MembershipRole.Leader,
            CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
        });
        db.EventRoleAssignments.Add(new EventRoleAssignment
        {
            Id = Guid.NewGuid(), EventId = seeded.Event.Id, MemberId = secondLeader,
            RoleRequirementKey = "event:venue.coordinator", ScopeType = "event",
            Status = EventRoleAssignmentStatus.Accepted, AssignedByMemberId = seeded.Owner,
            AcceptedUtc = DateTime.UtcNow, CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
        });
        db.EventRamAssessments.Add(new EventRamAssessment
        {
            EventId = seeded.Event.Id, Status = EventRamStatus.Approved, RamDataJson = "{}",
            ApprovedByMemberId = secondLeader, ApprovedUtc = DateTime.UtcNow,
            CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
        });
        var policy = await db.EventPackageGovernancePolicyVersions.SingleAsync();
        policy.EnforcementMode = EventPackageEnforcementMode.Enforced;
        await db.SaveChangesAsync();
        var service = new EventPackageService(db, Authorization());
        var generated = await service.GenerateAsync(seeded.Event.Id, seeded.Owner, new(), seeded.Plan.ETag,
            "waiver-generate", default);
        var submitted = await service.SubmitAsync(seeded.Event.Id, generated.Value!.Id, seeded.Owner,
            generated.Value.ETag, "waiver-submit", default);

        var wrongEndpoint = await service.DecideAsync(seeded.Event.Id, submitted.Value!.Id, seeded.Owner,
            new(EventPackageDecisionType.ConditionWaiver, new("Waive", "豁免")),
            submitted.Value.ETag, "waiver-wrong-endpoint", default);
        Assert.Equal(AppResultStatus.ValidationError, wrongEndpoint.Status);

        var approved = await service.DecideAsync(seeded.Event.Id, submitted.Value.Id, seeded.Owner,
            new(EventPackageDecisionType.ApproveWithConditions, new("Conditional", "附条件"), null,
                [new(new("Confirm venue access", "确认场地通行"), EventLifecycleGate.Publish,
                    "event:venue.coordinator", DateTime.UtcNow.AddHours(1))]),
            submitted.Value.ETag, "waiver-approve", default);
        Assert.True(approved.IsSuccess, approved.Message);
        var condition = approved.Value!.Conditions.Single();

        var disabled = await service.WaiveConditionAsync(seeded.Event.Id, approved.Value.Id, condition.Id,
            secondLeader, new(new("Exceptional approval", "例外批准")), condition.ETag,
            "waiver-disabled", default);
        Assert.Equal(AppResultStatus.Conflict, disabled.Status);
        Assert.Equal("event.package.condition.waiverNotAllowed", disabled.Message);

        policy.RulesJson = policy.RulesJson.Replace("\"conditionWaiverAllowed\":false",
            "\"conditionWaiverAllowed\":true", StringComparison.Ordinal);
        await db.SaveChangesAsync();
        var ownerCapabilities = await service.GetCapabilitiesAsync(
            seeded.Event.Id, approved.Value.Id, seeded.Owner, default);
        var conditionOwnerCapabilities = await service.GetCapabilitiesAsync(
            seeded.Event.Id, approved.Value.Id, secondLeader, default);
        Assert.True(ownerCapabilities.Value!.Conditions.Single().CanWaive);
        Assert.False(ownerCapabilities.Value.Conditions.Single().CanSatisfy);
        Assert.True(conditionOwnerCapabilities.Value!.Conditions.Single().CanSatisfy);
        Assert.False(conditionOwnerCapabilities.Value.Conditions.Single().CanWaive);
        var ownerAttempt = await service.WaiveConditionAsync(seeded.Event.Id, approved.Value.Id, condition.Id,
            secondLeader, new(new("Owner waiver", "负责人豁免")), condition.ETag,
            "waiver-owner", default);
        Assert.Equal(AppResultStatus.Forbidden, ownerAttempt.Status);

        var waived = await service.WaiveConditionAsync(seeded.Event.Id, approved.Value.Id, condition.Id,
            seeded.Owner, new(new("Exceptional approval", "例外批准")), condition.ETag,
            "waiver-enabled", default);
        var retry = await service.WaiveConditionAsync(seeded.Event.Id, approved.Value.Id, condition.Id,
            seeded.Owner, new(new("Exceptional approval", "例外批准")), condition.ETag,
            "waiver-enabled", default);

        Assert.True(waived.IsSuccess, waived.Message);
        Assert.Equal(EventPackageConditionStatus.Waived, waived.Value!.Condition.Status);
        Assert.Equal(waived.Value.Condition.Id, retry.Value!.Condition.Id);
        var persisted = await db.EventPackageConditions.AsNoTracking().SingleAsync();
        Assert.NotNull(persisted.WaivedByDecisionId);
        Assert.Contains(await db.EventPackageDecisions.AsNoTracking().ToListAsync(),
            x => x.Id == persisted.WaivedByDecisionId && x.DecisionType == EventPackageDecisionType.ConditionWaiver &&
                x.ActorMemberId == seeded.Owner);
        Assert.DoesNotContain("event.publish.conditionOpen", waived.Value.Lifecycle.ReasonCodes);
        Assert.DoesNotContain("event.publish.conditionExpired", waived.Value.Lifecycle.ReasonCodes);
    }

    [Fact]
    public async Task ReturnForAmendment_IsImmutableAndDoesNotCreateApprovalValidity()
    {
        await using var db = CreateDb();
        var seeded = await SeedAsync(db, series: false, modules: ["TEAM.WORK"]);
        var service = new EventPackageService(db, Authorization());
        var generated = await service.GenerateAsync(seeded.Event.Id, seeded.Owner, new(), seeded.Plan.ETag, "generate", default);
        var submitted = await service.SubmitAsync(seeded.Event.Id, generated.Value!.Id, seeded.Owner,
            generated.Value.ETag, "submit", default);

        var returned = await service.DecideAsync(seeded.Event.Id, submitted.Value!.Id, seeded.Owner,
            new(EventPackageDecisionType.ReturnForAmendment, new("Clarify the venue access plan", "请明确场地通行安排")),
            submitted.Value.ETag, "return", default);

        Assert.True(returned.IsSuccess, returned.Message);
        Assert.Equal(EventPackageStatus.ReturnedForAmendment, returned.Value!.Status);
        Assert.Equal(EventPackageApprovalValidity.NotDecided, returned.Value.ApprovalValidityStatus);
        Assert.Single(returned.Value.Decisions);
        var secondAttempt = await service.DecideAsync(seeded.Event.Id, returned.Value.Id, seeded.Owner,
            new(EventPackageDecisionType.Approve, new("Now approve", "现在批准")), returned.Value.ETag, "second-decision", default);
        Assert.Equal(AppResultStatus.Conflict, secondAttempt.Status);
        Assert.Single(await db.EventPackageDecisions.ToListAsync());
    }

    [Fact]
    public async Task EnforcedPublishGate_RejectsDraftPackageAndApprovalDoesNotAutoPublish()
    {
        await using var db = CreateDb();
        var seeded = await SeedAsync(db, series: false, modules: ["TEAM.WORK"]);
        var policy = await db.EventPackageGovernancePolicyVersions.SingleAsync();
        policy.EnforcementMode = EventPackageEnforcementMode.Enforced;
        db.EventRamAssessments.Add(new EventRamAssessment
        {
            EventId = seeded.Event.Id, Status = EventRamStatus.Approved,
            RamDataJson = "{}", ApprovedByMemberId = seeded.Owner, ApprovedUtc = DateTime.UtcNow,
            CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
        var service = new EventPackageService(db, Authorization());
        var generated = await service.GenerateAsync(seeded.Event.Id, seeded.Owner, new(), seeded.Plan.ETag, "generate", default);
        var lifecycle = await service.GetLifecycleAsync(seeded.Event.Id, seeded.Owner, default);

        var blocked = await service.PublishAsync(seeded.Event.Id, seeded.Owner,
            new(generated.Value!.Id, generated.Value.ETag, lifecycle.Value!.ETag), "publish-draft", default);
        Assert.Equal(AppResultStatus.Conflict, blocked.Status);
        Assert.Equal("event.publish.packageNotApproved", blocked.Message);

        var submitted = await service.SubmitAsync(seeded.Event.Id, generated.Value.Id, seeded.Owner,
            generated.Value.ETag, "submit", default);
        var approved = await service.DecideAsync(seeded.Event.Id, generated.Value.Id, seeded.Owner,
            new(EventPackageDecisionType.Approve, new("Approved for publication", "批准进入发布门禁")),
            submitted.Value!.ETag, "approve", default);
        var beforePublish = await service.GetLifecycleAsync(seeded.Event.Id, seeded.Owner, default);
        Assert.Equal(EventPublicationStatus.LegacyImplicit, beforePublish.Value!.PublicationStatus);

        var published = await service.PublishAsync(seeded.Event.Id, seeded.Owner,
            new(approved.Value!.Id, approved.Value.ETag, beforePublish.Value.ETag), "publish-approved", default);
        Assert.True(published.IsSuccess, published.Message);
        Assert.Equal(EventPublicationStatus.Published, published.Value!.PublicationStatus);
        Assert.Equal(approved.Value.Id, published.Value.PublishedPackageId);
        Assert.True(published.Value.PublishGateSatisfied);

        var revoked = await service.RevokeDecisionAsync(seeded.Event.Id, approved.Value.Id,
            approved.Value.Decisions[0].Id, seeded.Owner, new(new("Approval withdrawn", "撤销整体批准")),
            approved.Value.ETag, "revoke", default);
        Assert.True(revoked.IsSuccess, revoked.Message);
        Assert.Equal(EventPackageApprovalValidity.Revoked, revoked.Value!.ApprovalValidityStatus);
        Assert.Equal(2, revoked.Value.Decisions.Count);
        var invalidLifecycle = await service.GetLifecycleAsync(seeded.Event.Id, seeded.Owner, default);
        Assert.False(invalidLifecycle.Value!.PublishGateSatisfied);
        Assert.Contains("event.publish.packageNotApproved", invalidLifecycle.Value.ReasonCodes);

        var unpublished = await service.UnpublishAsync(seeded.Event.Id, seeded.Owner,
            new(new("Event withdrawn from public view", "活动已撤下公开展示"), published.Value.ETag), "unpublish", default);
        Assert.True(unpublished.IsSuccess, unpublished.Message);
        Assert.Equal(EventPublicationStatus.Unpublished, unpublished.Value!.PublicationStatus);
        Assert.False(EventVisibilityPolicy.IsPublished(new GroupEventSummaryDto(
            seeded.Event.Id, seeded.Event.GroupId, seeded.Owner, "Event", "活动", DateTime.UtcNow,
            DateTime.UtcNow.AddDays(1), "{}", DateTime.UtcNow, DateTime.UtcNow,
            RamStatus: EventRamStatus.Approved, PublicationStatus: unpublished.Value.PublicationStatus,
            PublicationGateSatisfied: unpublished.Value.PublishGateSatisfied)));
    }

    [Fact]
    public async Task EnforcedRegistrationGate_RequiresApprovalAndExplicitOpenThenClose()
    {
        await using var db = CreateDb();
        var seeded = await SeedAsync(db, series: false, modules: ["TEAM.WORK"]);
        (await db.EventPackageGovernancePolicyVersions.SingleAsync()).EnforcementMode = EventPackageEnforcementMode.Enforced;
        seeded.Event.EventDataJson = JsonSerializer.Serialize(new
        {
            maxCapacity = 40,
            registrationDeadline = DateTime.UtcNow.AddDays(5).ToString("O"),
            visibility = "groupVisible"
        });
        db.EventRamAssessments.Add(new EventRamAssessment
        {
            EventId = seeded.Event.Id, Status = EventRamStatus.Approved, RamDataJson = "{}",
            ApprovedByMemberId = seeded.Owner, ApprovedUtc = DateTime.UtcNow,
            CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
        var service = new EventPackageService(db, Authorization());
        var generated = await service.GenerateAsync(seeded.Event.Id, seeded.Owner, new(), seeded.Plan.ETag, "generate", default);
        var initialLifecycle = await service.GetLifecycleAsync(seeded.Event.Id, seeded.Owner, default);
        var blocked = await service.OpenRegistrationAsync(seeded.Event.Id, seeded.Owner,
            new(generated.Value!.Id, generated.Value.ETag, initialLifecycle.Value!.RegistrationETag), "open-draft", default);
        Assert.Equal("event.registration.packageNotApproved", blocked.Message);

        var submitted = await service.SubmitAsync(seeded.Event.Id, generated.Value.Id, seeded.Owner,
            generated.Value.ETag, "submit", default);
        var approved = await service.DecideAsync(seeded.Event.Id, generated.Value.Id, seeded.Owner,
            new(EventPackageDecisionType.Approve, new("Registration may open", "可以开放报名")),
            submitted.Value!.ETag, "approve", default);
        var opened = await service.OpenRegistrationAsync(seeded.Event.Id, seeded.Owner,
            new(approved.Value!.Id, approved.Value.ETag, initialLifecycle.Value.RegistrationETag), "open", default);

        Assert.True(opened.IsSuccess, opened.Message);
        Assert.Equal(EventRegistrationStatus.Open, opened.Value!.RegistrationStatus);
        Assert.True(opened.Value.RegistrationGateSatisfied);
        Assert.True(EventLifecyclePolicy.CanCreateEnrollment(seeded.Event, DateTime.UtcNow, out _));

        var closed = await service.CloseRegistrationAsync(seeded.Event.Id, seeded.Owner,
            new(new("Registration capacity review", "报名容量复核"), opened.Value.RegistrationETag), "close", default);
        Assert.True(closed.IsSuccess, closed.Message);
        Assert.Equal(EventRegistrationStatus.Closed, closed.Value!.RegistrationStatus);
        Assert.False(EventLifecyclePolicy.CanCreateEnrollment(seeded.Event, DateTime.UtcNow, out _));
    }

    [Fact]
    public async Task ExecutionConfirmation_IsExplicitPackageBoundAndLimitedToPolicyWindow()
    {
        await using var db = CreateDb();
        var seeded = await SeedAsync(db, series: false, modules: ["TEAM.WORK"]);
        (await db.EventPackageGovernancePolicyVersions.SingleAsync()).EnforcementMode = EventPackageEnforcementMode.Enforced;
        seeded.Event.StartDate = DateTime.UtcNow.AddHours(24);
        seeded.Event.EndDate = DateTime.UtcNow.AddHours(27);
        seeded.Occurrences[0].StartUtc = seeded.Event.StartDate;
        seeded.Occurrences[0].EndUtc = seeded.Event.EndDate;
        seeded.Occurrences[0].LocalDate = DateOnly.FromDateTime(seeded.Event.StartDate);
        db.EventRamAssessments.Add(new EventRamAssessment
        {
            EventId = seeded.Event.Id, Status = EventRamStatus.Approved, RamDataJson = "{}",
            ApprovedByMemberId = seeded.Owner, ApprovedUtc = DateTime.UtcNow,
            CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
        var service = new EventPackageService(db, Authorization());
        var generated = await service.GenerateAsync(seeded.Event.Id, seeded.Owner, new(), seeded.Plan.ETag, "generate", default);
        var lifecycle = await service.GetLifecycleAsync(seeded.Event.Id, seeded.Owner, default);
        var draftBlocked = await service.ConfirmExecutionAsync(seeded.Event.Id, seeded.Owner,
            new(EventPackageScopeType.Event, null, generated.Value!.Id, generated.Value.ETag, lifecycle.Value!.ExecutionETag),
            "confirm-draft", default);
        Assert.Equal("event.execute.packageNotApproved", draftBlocked.Message);

        var submitted = await service.SubmitAsync(seeded.Event.Id, generated.Value.Id, seeded.Owner,
            generated.Value.ETag, "submit", default);
        var approved = await service.DecideAsync(seeded.Event.Id, generated.Value.Id, seeded.Owner,
            new(EventPackageDecisionType.Approve, new("Ready for execution", "已具备执行条件")),
            submitted.Value!.ETag, "approve", default);
        var confirmed = await service.ConfirmExecutionAsync(seeded.Event.Id, seeded.Owner,
            new(EventPackageScopeType.Event, null, approved.Value!.Id, approved.Value.ETag, lifecycle.Value.ExecutionETag),
            "confirm", default);

        Assert.True(confirmed.IsSuccess, confirmed.Message);
        Assert.Equal(EventExecutionStatus.Confirmed, confirmed.Value!.ExecutionStatus);
        Assert.Equal(approved.Value.Id, confirmed.Value.ExecutionPackageId);
        Assert.True(confirmed.Value.ExecutionGateSatisfied);
    }

    [Fact]
    public async Task GovernanceCriticalChange_InvalidatesApprovalAndFailsClosedWithoutDeletingHistory()
    {
        await using var db = CreateDb();
        var seeded = await SeedAsync(db, series: false, modules: ["TEAM.WORK"]);
        var package = new EventPackage
        {
            Id = Guid.NewGuid(), EventId = seeded.Event.Id, Version = 1, EventPlanVersion = 1,
            GovernancePolicyVersionId = (await db.EventPackageGovernancePolicyVersions.SingleAsync()).Id,
            GovernancePolicyVersion = "2026.1", GovernanceTier = EventGovernanceTier.Light,
            Status = EventPackageStatus.Approved, ApprovalValidityStatus = EventPackageApprovalValidity.Active,
            ContentHash = new string('b', 64), SourceVectorHash = new string('c', 64),
            GeneratedByMemberId = seeded.Owner, GeneratedUtc = DateTime.UtcNow,
            Decisions =
            [
                new EventPackageDecision
                {
                    Id = Guid.NewGuid(), DecisionType = EventPackageDecisionType.Approve,
                    ActorMemberId = seeded.Owner, ReasonEn = "Approved", ReasonZh = "已批准",
                    DecidedUtc = DateTime.UtcNow, EffectiveUtc = DateTime.UtcNow,
                    RequestHash = new string('d', 64)
                }
            ]
        };
        db.EventPackages.Add(package);
        seeded.Event.PublicationStatus = EventPublicationStatus.Published;
        seeded.Event.PublishedPackageId = package.Id;
        seeded.Event.RegistrationStatus = EventRegistrationStatus.Open;
        seeded.Event.RegistrationPackageId = package.Id;
        seeded.Event.ExecutionStatus = EventExecutionStatus.Confirmed;
        seeded.Event.ExecutionPackageId = package.Id;
        await db.SaveChangesAsync();

        var result = await new EventPackageInvalidationService(db).InvalidateForMaterialChangeAsync(
            seeded.Event, seeded.Owner, "event.plan.accepted", "governanceCritical");
        await db.SaveChangesAsync();

        Assert.Equal(1, result.InvalidatedPackageCount);
        Assert.True(result.PublicationWithdrawn);
        Assert.True(result.RegistrationPaused);
        Assert.True(result.ExecutionBlocked);
        Assert.Equal(EventPackageApprovalValidity.Invalidated, package.ApprovalValidityStatus);
        Assert.Equal("event.plan.accepted", package.Decisions.Single().InvalidatedReasonCode);
        Assert.Single(package.Decisions);
        Assert.Equal(EventPublicationStatus.Unpublished, seeded.Event.PublicationStatus);
        Assert.Equal(EventRegistrationStatus.Closed, seeded.Event.RegistrationStatus);
        Assert.Equal(EventExecutionStatus.Invalidated, seeded.Event.ExecutionStatus);
        Assert.Equal(2, await db.AuditLogs.CountAsync());
        Assert.Contains(await db.EventTasks.ToListAsync(), x => x.IsRequired &&
            x.AssignedMemberId == seeded.Event.AccountableOwnerMemberId && x.Status == EventTaskStatus.Todo);
    }

    [Fact]
    public async Task ModuleChange_InvalidatesOnlyPackagesThatContainTheAffectedModule()
    {
        await using var db = CreateDb();
        var seeded = await SeedAsync(db, series: false, modules: ["TEAM.WORK"]);
        var policyId = (await db.EventPackageGovernancePolicyVersions.SingleAsync()).Id;
        EventPackage Package(string moduleCode, int version) => new()
        {
            Id = Guid.NewGuid(), EventId = seeded.Event.Id, Version = version, EventPlanVersion = 1,
            GovernancePolicyVersionId = policyId, GovernancePolicyVersion = "2026.1",
            GovernanceTier = EventGovernanceTier.Light, Status = EventPackageStatus.Approved,
            ApprovalValidityStatus = EventPackageApprovalValidity.Active,
            ManifestJson = EventPackageCanonicalizer.Serialize(new
            {
                modules = new[] { new { moduleCode } }
            }),
            ContentHash = new string((char)('a' + version), 64),
            SourceVectorHash = new string((char)('d' + version), 64),
            GeneratedByMemberId = seeded.Owner, GeneratedUtc = DateTime.UtcNow
        };
        var venue = Package("PLACE.RESOURCE", 1);
        var travel = Package("MOVE.STAY", 2);
        db.EventPackages.AddRange(venue, travel);
        await db.SaveChangesAsync();

        var result = await new EventPackageInvalidationService(db).InvalidateForModuleChangeAsync(
            seeded.Event, seeded.Owner, "PLACE.RESOURCE", "event.venue.reservationChanged",
            "governanceCritical");
        await db.SaveChangesAsync();

        Assert.Equal(1, result.InvalidatedPackageCount);
        Assert.Equal(EventPackageApprovalValidity.Invalidated, venue.ApprovalValidityStatus);
        Assert.Equal(EventPackageApprovalValidity.Active, travel.ApprovalValidityStatus);
        Assert.Single(await db.EventTasks.Where(x => x.TitleEn.Contains("PLACE.RESOURCE")).ToListAsync());
    }

    [Fact]
    public async Task OccurrenceVenueChange_RequiresLocalReviewWithoutInvalidatingUnrelatedSeriesCoverage()
    {
        await using var db = CreateDb();
        var seeded = await SeedAsync(db, series: true, modules: ["TEAM.WORK", "PLACE.RESOURCE"]);
        var service = new EventPackageService(db, Authorization());
        var baseline = await service.GenerateAsync(seeded.Event.Id, seeded.Owner, new(),
            seeded.Plan.ETag, "series-baseline", default);
        var previousLocal = await service.GenerateAsync(seeded.Event.Id, seeded.Owner,
            new(EventPackageScopeType.Occurrence, seeded.Occurrences[0].Id),
            seeded.Plan.ETag, "old-local", default);
        Assert.True(baseline.IsSuccess, baseline.Message);
        Assert.True(previousLocal.IsSuccess, previousLocal.Message);
        var storedBaseline = await db.EventPackages.SingleAsync(x => x.Id == baseline.Value!.Id);
        var storedLocal = await db.EventPackages.SingleAsync(x => x.Id == previousLocal.Value!.Id);
        storedBaseline.Status = EventPackageStatus.Approved;
        storedBaseline.ApprovalValidityStatus = EventPackageApprovalValidity.Active;
        storedLocal.Status = EventPackageStatus.Approved;
        storedLocal.ApprovalValidityStatus = EventPackageApprovalValidity.Active;
        seeded.Occurrences[0].ExecutionStatus = EventExecutionStatus.Confirmed;
        seeded.Occurrences[0].ExecutionPackageId = storedBaseline.Id;
        seeded.Occurrences[0].ExecutionConfirmedByMemberId = seeded.Owner;
        seeded.Occurrences[0].ExecutionConfirmedUtc = DateTime.UtcNow;
        await db.SaveChangesAsync();

        Assert.Equal(2, await db.EventPackageSourceReferences.CountAsync(x =>
            x.EventPackageId == storedBaseline.Id && x.ModuleCode == "PLACE.RESOURCE" &&
            x.SubjectType == "moduleOccurrence"));
        var invalidation = await new EventPackageInvalidationService(db)
            .InvalidateForOccurrenceModuleChangeAsync(seeded.Event, seeded.Occurrences[0].Id,
                seeded.Owner, "PLACE.RESOURCE", "event.venue.reservationChanged",
                "governanceCritical");
        await db.SaveChangesAsync();

        Assert.True(invalidation.LocalReviewRequired);
        Assert.True(invalidation.ExecutionBlocked);
        Assert.Equal(1, invalidation.InvalidatedPackageCount);
        Assert.Equal(EventPackageApprovalValidity.Active, storedBaseline.ApprovalValidityStatus);
        Assert.Equal(EventPackageApprovalValidity.Invalidated, storedLocal.ApprovalValidityStatus);
        Assert.True(EventOccurrencePackageExceptionState.HasOpen(seeded.Occurrences[0].ExceptionsJson));
        Assert.False(EventOccurrencePackageExceptionState.HasOpen(seeded.Occurrences[1].ExceptionsJson));
        Assert.Equal(EventExecutionStatus.Invalidated, seeded.Occurrences[0].ExecutionStatus);
        Assert.Equal(EventExecutionStatus.NotConfirmed, seeded.Occurrences[1].ExecutionStatus);

        var replacement = await service.GenerateAsync(seeded.Event.Id, seeded.Owner,
            new(EventPackageScopeType.Occurrence, seeded.Occurrences[0].Id),
            seeded.Plan.ETag, "new-local", default);
        var submitted = await service.SubmitAsync(seeded.Event.Id, replacement.Value!.Id, seeded.Owner,
            replacement.Value.ETag, "new-local-submit", default);
        var approved = await service.DecideAsync(seeded.Event.Id, replacement.Value.Id, seeded.Owner,
            new(EventPackageDecisionType.Approve, new("Occurrence reviewed", "场次已复核")),
            submitted.Value!.ETag, "new-local-approve", default);

        Assert.True(approved.IsSuccess, approved.Message);
        Assert.False(EventOccurrencePackageExceptionState.HasOpen(seeded.Occurrences[0].ExceptionsJson));
        Assert.Contains(await db.EventTasks.ToListAsync(), task =>
            task.TitleEn.Contains("one occurrence") && task.Status == EventTaskStatus.Done);
        Assert.Contains(await db.AuditLogs.ToListAsync(), audit =>
            audit.Action == "event.package.occurrenceReviewResolved");
    }

    [Fact]
    public async Task OccurrenceExecution_UsesEventBaselineForUnaffectedScopeButBlocksOpenException()
    {
        await using var db = CreateDb();
        var seeded = await SeedAsync(db, series: true, modules: ["TEAM.WORK"]);
        var now = DateTime.UtcNow;
        seeded.Occurrences[0].StartUtc = now.AddHours(24);
        seeded.Occurrences[0].EndUtc = now.AddHours(26);
        seeded.Occurrences[1].StartUtc = now.AddHours(30);
        seeded.Occurrences[1].EndUtc = now.AddHours(32);
        seeded.Event.StartDate = seeded.Occurrences[0].StartUtc;
        seeded.Event.EndDate = seeded.Occurrences[1].EndUtc;
        (await db.EventPackageGovernancePolicyVersions.SingleAsync()).EnforcementMode =
            EventPackageEnforcementMode.Enforced;
        await db.SaveChangesAsync();
        var service = new EventPackageService(db, Authorization());
        var generated = await service.GenerateAsync(seeded.Event.Id, seeded.Owner, new(),
            seeded.Plan.ETag, "execution-baseline", default);
        var submitted = await service.SubmitAsync(seeded.Event.Id, generated.Value!.Id, seeded.Owner,
            generated.Value.ETag, "execution-baseline-submit", default);
        var approved = await service.DecideAsync(seeded.Event.Id, generated.Value.Id, seeded.Owner,
            new(EventPackageDecisionType.Approve, new("Series approved", "系列已批准")),
            submitted.Value!.ETag, "execution-baseline-approve", default);
        seeded.Occurrences[0].ExceptionsJson = EventOccurrencePackageExceptionState.Raise(
            seeded.Occurrences[0].ExceptionsJson, "PLACE.RESOURCE", "event.venue.reservationChanged",
            "governanceCritical", seeded.Owner, now, [approved.Value!.Id], Guid.NewGuid(), out _);
        await db.SaveChangesAsync();

        var unaffectedLifecycle = await service.GetLifecycleAsync(
            seeded.Event.Id, seeded.Owner, default, seeded.Occurrences[1].Id);
        var unaffected = await service.ConfirmExecutionAsync(seeded.Event.Id, seeded.Owner,
            new(EventPackageScopeType.Occurrence, seeded.Occurrences[1].Id, approved.Value.Id,
                approved.Value.ETag, unaffectedLifecycle.Value!.ExecutionETag), "execute-unaffected", default);
        Assert.True(unaffected.IsSuccess, unaffected.Message);
        Assert.Equal(EventExecutionStatus.Confirmed, seeded.Occurrences[1].ExecutionStatus);
        Assert.Equal(approved.Value.Id, seeded.Occurrences[1].ExecutionPackageId);
        Assert.Equal(EventExecutionStatus.NotConfirmed, seeded.Event.ExecutionStatus);
        Assert.Equal(EventExecutionStatus.NotConfirmed, seeded.Occurrences[0].ExecutionStatus);

        var affectedLifecycle = await service.GetLifecycleAsync(
            seeded.Event.Id, seeded.Owner, default, seeded.Occurrences[0].Id);
        var affected = await service.ConfirmExecutionAsync(seeded.Event.Id, seeded.Owner,
            new(EventPackageScopeType.Occurrence, seeded.Occurrences[0].Id, approved.Value.Id,
                approved.Value.ETag, affectedLifecycle.Value!.ExecutionETag), "execute-affected", default);
        Assert.Equal(AppResultStatus.Conflict, affected.Status);
        Assert.Equal("event.execute.occurrenceReviewRequired", affected.Message);
    }

    [Fact]
    public async Task RequiredTaskMutation_UsesTeamModuleInvalidationHookAndPreservesHistory()
    {
        await using var db = CreateDb();
        var seeded = await SeedAsync(db, series: false, modules: ["TEAM.WORK"]);
        var package = new EventPackage
        {
            Id = Guid.NewGuid(), EventId = seeded.Event.Id, Version = 1, EventPlanVersion = 1,
            GovernancePolicyVersionId = (await db.EventPackageGovernancePolicyVersions.SingleAsync()).Id,
            GovernancePolicyVersion = "2026.1", GovernanceTier = EventGovernanceTier.Light,
            Status = EventPackageStatus.Approved, ApprovalValidityStatus = EventPackageApprovalValidity.Active,
            ManifestJson = "{\"modules\":[{\"moduleCode\":\"TEAM.WORK\"}]}",
            ContentHash = new string('e', 64), SourceVectorHash = new string('f', 64),
            GeneratedByMemberId = seeded.Owner, GeneratedUtc = DateTime.UtcNow
        };
        db.EventPackages.Add(package);
        await db.SaveChangesAsync();
        var operations = new EventOperationsService(
            db, Authorization(), new EventPackageInvalidationService(db));

        var result = await operations.CreateTaskAsync(seeded.Event.Id, seeded.Owner,
            new(new("Confirm emergency contact", "确认紧急联系人"), null, seeded.Owner,
                DateTime.UtcNow.AddDays(1), IsRequired: true), default);

        Assert.True(result.IsSuccess, result.Message);
        Assert.Equal(EventPackageApprovalValidity.Invalidated,
            (await db.EventPackages.SingleAsync()).ApprovalValidityStatus);
        Assert.Equal(2, await db.EventTasks.CountAsync());
        Assert.Contains(await db.AuditLogs.ToListAsync(), x => x.Action == "event.package.invalidated");
    }

    [Fact]
    public async Task PublicProjection_RevalidatesCurrentGateBeforeReturningSharedCachedContent()
    {
        await using var db = CreateDb();
        var seeded = await SeedAsync(db, series: false, modules: ["TEAM.WORK"]);
        seeded.Event.EventDataJson = "{\"visibility\":\"public\"}";
        var package = new EventPackage
        {
            Id = Guid.NewGuid(), EventId = seeded.Event.Id, Version = 1, EventPlanVersion = 1,
            GovernancePolicyVersionId = (await db.EventPackageGovernancePolicyVersions.SingleAsync()).Id,
            GovernancePolicyVersion = "2026.1", GovernanceTier = EventGovernanceTier.Light,
            Status = EventPackageStatus.Approved, ApprovalValidityStatus = EventPackageApprovalValidity.Active,
            ContentHash = new string('a', 64), SourceVectorHash = new string('b', 64),
            ManifestJson = "{\"modules\":[]}", GeneratedByMemberId = seeded.Owner,
            GeneratedUtc = DateTime.UtcNow,
            Decisions =
            [
                new EventPackageDecision
                {
                    Id = Guid.NewGuid(), DecisionType = EventPackageDecisionType.Approve,
                    ActorMemberId = seeded.Owner, ReasonEn = "Approved", ReasonZh = "已批准",
                    DecidedUtc = DateTime.UtcNow, EffectiveUtc = DateTime.UtcNow,
                    ExpiresUtc = DateTime.UtcNow.AddDays(1), RequestHash = new string('c', 64)
                }
            ]
        };
        db.EventPackages.Add(package);
        db.EventRamAssessments.Add(new EventRamAssessment
        {
            EventId = seeded.Event.Id, Status = EventRamStatus.Approved, RamDataJson = "{}",
            ApprovedByMemberId = seeded.Owner, ApprovedUtc = DateTime.UtcNow,
            CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
        });
        seeded.Event.PublicationStatus = EventPublicationStatus.Published;
        seeded.Event.PublicationGateMode = EventPackageEnforcementMode.Enforced;
        seeded.Event.PublishedPackageId = package.Id;
        await db.SaveChangesAsync();
        var registrations = new ServiceCollection();
        registrations.AddHybridCache();
        using var services = registrations.BuildServiceProvider();
        var readService = new EventReadService(db, services.GetRequiredService<HybridCache>());

        Assert.Single(await readService.GetPublicUpcomingEventsAsync(DateTime.UtcNow.AddDays(-1), 50, default));
        Assert.True((await readService.GetGroupEventsAsync(seeded.Event.GroupId, default))
            .Single().PublicationGateSatisfied);
        package.ApprovalValidityStatus = EventPackageApprovalValidity.Invalidated;
        await db.SaveChangesAsync();

        Assert.Empty(await readService.GetPublicUpcomingEventsAsync(DateTime.UtcNow.AddDays(-1), 50, default));
        Assert.False((await readService.GetGroupEventsAsync(seeded.Event.GroupId, default))
            .Single().PublicationGateSatisfied);
    }

    [Fact]
    public async Task CosmeticChange_DoesNotInvalidateActiveApproval()
    {
        await using var db = CreateDb();
        var seeded = await SeedAsync(db, series: false, modules: ["TEAM.WORK"]);

        var result = await new EventPackageInvalidationService(db).InvalidateForMaterialChangeAsync(
            seeded.Event, seeded.Owner, "event.title.changed", "cosmetic");

        Assert.False(result.Changed);
        Assert.Empty(await db.AuditLogs.ToListAsync());
    }

    private static AlifeDbContext CreateDb() => new(new DbContextOptionsBuilder<AlifeDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString("N")).Options);

    private static IGroupAuthorizationService Authorization()
    {
        var service = Substitute.For<IGroupAuthorizationService>();
        service.IsLeaderOrCoLeaderAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(false);
        service.IsApprovedMemberAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(false);
        return service;
    }

    private static async Task<Seeded> SeedAsync(AlifeDbContext db, bool series, IReadOnlyList<string> modules,
        Guid? parentEventId = null, bool legacy = false)
    {
        var now = new DateTime(2026, 9, 2, 0, 0, 0, DateTimeKind.Utc);
        var owner = Guid.NewGuid(); var groupId = Guid.NewGuid();
        var eventSeries = series ? new EventSeries
        {
            Id = Guid.NewGuid(), OwningGroupId = groupId, NameEn = "Series", NameZh = "系列",
            RecurrenceRule = "FREQ=WEEKLY", TimeZone = "Pacific/Auckland", RollingOccurrenceWeeks = 12,
            CreatedByMemberId = owner, CreatedUtc = now, UpdatedUtc = now
        } : null;
        var groupEvent = new GroupEvent
        {
            Id = Guid.NewGuid(), GroupId = groupId, CreatedByMemberId = owner, AccountableOwnerMemberId = owner,
            EventSeriesId = eventSeries?.Id, ParentEventId = parentEventId, TitleEn = "Outdoor gathering", TitleZh = "户外聚会",
            StartDate = now.AddDays(10), EndDate = now.AddDays(10).AddHours(2), CreatedUtc = now, UpdatedUtc = now,
            PlanConcurrencyToken = Guid.NewGuid(), ActivePlanVersion = 1
        };
        var compose = new EventCompositionEngine().Compose(new(EventCompositionDefinitions.SchemaVersion,
            "simple-social", new([]), modules.Where(x => x != "TEAM.WORK")
                .Select(x => new ModuleSelectionInput(x, true)).ToArray(), null, "shared-meal"),
            new EventCompositionContext("\"seed\"", CheckedUtc: now));
        Assert.True(compose.IsSuccess, compose.Message);
        var selectedPlan = compose.Value! with
        {
            ModuleDecisions = compose.Value.ModuleDecisions.Select(x => modules.Contains(x.ModuleCode)
                ? x with { Status = x.ModuleCode == "TEAM.WORK" ? EventModuleDecisionStatus.Required : EventModuleDecisionStatus.Selected }
                : x with { Status = EventModuleDecisionStatus.Inactive }).ToArray()
        };
        var factSet = new EventFactSet
        {
            Id = Guid.NewGuid(), EventId = groupEvent.Id, Version = 1, SchemaVersion = EventCompositionDefinitions.SchemaVersion,
            FactsJson = "[]", SourceHash = new string('a', 64), CreatedByMemberId = owner, CreatedUtc = now
        };
        var planEntity = new EventPlanSnapshot
        {
            Id = Guid.NewGuid(), EventId = groupEvent.Id, SourceFactSetId = factSet.Id, Version = 1,
            SchemaVersion = EventCompositionDefinitions.SchemaVersion, ProposalHash = selectedPlan.ProposalHash,
            ETag = "\"plan-1-seed\"", ArchetypeCode = "simple-social", ArchetypeVersion = 1,
            ActivityTypeCode = "shared-meal", ActivityTypeVersion = 2,
            SnapshotJson = EventCompositionPersistence.SerializePlan(selectedPlan, []), AcceptedByMemberId = owner,
            AcceptedUtc = now, IsActive = true, IsLegacyBackfill = legacy, CreatedUtc = now
        };
        var policy = new EventPackageGovernancePolicyVersion
        {
            Id = Guid.NewGuid(), Version = "2026.1", SchemaVersion = "1", IsPublished = true,
            RulesJson = "{\"schemaVersion\":\"1\",\"preEventConfirmationWindowHours\":72,\"tierRules\":[" +
                "{\"tier\":\"light\",\"whenAnyConfirmedFactCodes\":[],\"whenAnyActivityTypeCodes\":[],\"whenAnyModuleCodes\":[]}," +
                "{\"tier\":\"standard\",\"whenAnyConfirmedFactCodes\":[\"money.hasMoneyFlow\"],\"whenAnyActivityTypeCodes\":[],\"whenAnyModuleCodes\":[\"PEOPLE.REGISTRATION\"]}," +
                "{\"tier\":\"enhanced\",\"whenAnyConfirmedFactCodes\":[\"people.childrenPresent\",\"move.transportRequired\"],\"whenAnyActivityTypeCodes\":[\"outdoor-activity\"],\"whenAnyModuleCodes\":[\"SAFEGUARDING.CHILD\",\"FESTIVAL.OPERATIONS\"]}]," +
                "\"authorityByTier\":{\"light\":{\"minimumApproverCount\":1},\"standard\":{\"minimumApproverCount\":1},\"enhanced\":{\"minimumApproverCount\":1}}," +
                "\"approvalValidityByTier\":{\"light\":\"P30D\",\"standard\":\"P14D\",\"enhanced\":\"P7D\"}," +
                "\"materialChangeRules\":[],\"conditionWaiverAllowed\":false,\"delegationRules\":{\"enabled\":false}," +
                "\"legacyRollout\":{\"effectiveFromUtc\":\"2026-09-01T00:00:00Z\",\"transitionDeadlineUtc\":\"2026-12-01T00:00:00Z\",\"cohortRule\":\"new-events-first\",\"safetyCriticalModuleCodes\":[\"SAFETY.RAM\",\"SAFEGUARDING.CHILD\"],\"transitionByMode\":{\"off\":\"legacyReadOnlyPackage\",\"dryRun\":\"timeLimitedCompatibility\",\"enforced\":\"formalPackageRequired\"}}}",
            EnforcementMode = EventPackageEnforcementMode.Off, EffectiveFromUtc = now.AddDays(-1),
            PublishedByMemberId = owner, PublishedUtc = now
        };
        var occurrences = Enumerable.Range(0, series ? 2 : 1).Select(index => new EventOccurrence
        {
            Id = Guid.NewGuid(), EventId = groupEvent.Id, StartUtc = groupEvent.StartDate.AddDays(index * 7),
            EndUtc = groupEvent.EndDate.AddDays(index * 7), LocalDate = DateOnly.FromDateTime(groupEvent.StartDate.AddDays(index * 7)),
            CreatedUtc = now, UpdatedUtc = now
        }).ToArray();
        if (eventSeries is not null) db.EventSeries.Add(eventSeries);
        db.GroupEvents.Add(groupEvent); db.EventFactSets.Add(factSet); db.EventPlanSnapshots.Add(planEntity);
        db.EventPackageGovernancePolicyVersions.Add(policy); db.EventOccurrences.AddRange(occurrences);
        await db.SaveChangesAsync();
        return new(groupEvent, owner, EventCompositionPersistence.ToSnapshotDto(planEntity), occurrences);
    }

    private sealed record Seeded(GroupEvent Event, Guid Owner, EventPlanSnapshotDto Plan, EventOccurrence[] Occurrences);
}
