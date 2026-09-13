using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.Events;

public sealed partial class EventPackageFoundationTests
{
    private static async Task<(Seeded Seed, EventPackageService Service)> DutyFixture(AlifeDbContext db, params string[] modules)
    {
        var seed = await SeedAsync(db, false, modules);
        seed.Event.StartDate = DateTime.UtcNow.AddHours(24); seed.Event.EndDate = seed.Event.StartDate.AddHours(2);
        seed.Event.PublicationStatus = EventPublicationStatus.Draft;
        seed.Occurrences[0].StartUtc = seed.Event.StartDate; seed.Occurrences[0].EndUtc = seed.Event.EndDate;
        db.Groups.Add(new() { Id = seed.Event.GroupId, IsChurch = true });
        db.Members.Add(new() { Id = seed.Owner });
        db.GroupMemberships.Add(new() { Id = Guid.NewGuid(), GroupId = seed.Event.GroupId, MemberId = seed.Owner, Status = MembershipStatus.Approved, Role = MembershipRole.Leader });
        foreach (var requirement in seed.Plan.Plan.RoleRequirements.Where(x => x.Minimum > 0))
            db.EventRoleAssignments.Add(new() { Id = Guid.NewGuid(), EventId = seed.Event.Id, MemberId = seed.Owner, Status = EventRoleAssignmentStatus.Accepted, RoleRequirementKey = requirement.RequirementKey });
        await db.SaveChangesAsync();
        var auth = Authorization(); auth.IsApprovedMemberAsync(seed.Event.GroupId, Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(call => db.GroupMemberships.Any(x => x.GroupId == seed.Event.GroupId && x.MemberId == call.ArgAt<Guid>(1) && x.Status == MembershipStatus.Approved));
        return (seed, new(db, auth));
    }

    private static async Task<EventPackageDto> SubmittedDutyPackage(EventPackageService service, Seeded seed)
    {
        var generated = await service.GenerateAsync(seed.Event.Id, seed.Owner, new(EventPackageScopeType.Event), seed.Plan.ETag, Guid.NewGuid().ToString(), default);
        Assert.True(generated.IsSuccess, generated.Message);
        var submitted = await service.SubmitAsync(seed.Event.Id, generated.Value!.Id, seed.Owner, generated.Value.ETag, Guid.NewGuid().ToString(), default);
        Assert.True(submitted.IsSuccess, submitted.Message); return submitted.Value!;
    }

    [Fact]
    public async Task DutyProjection_PackageQuorumHandsOffAndLaterLeaderCanDiscoverWithoutAnyNotice()
    {
        await using var db = CreateDb(); var f = await DutyFixture(db, "TEAM.WORK", "PEOPLE.REGISTRATION");
        var policy = await db.EventPackageGovernancePolicyVersions.SingleAsync();
        policy.RulesJson = policy.RulesJson.Replace("\"standard\":{\"minimumApproverCount\":1}", "\"standard\":{\"minimumApproverCount\":2}"); await db.SaveChangesAsync();
        var submitted = await SubmittedDutyPackage(f.Service, f.Seed);
        var first = Guid.NewGuid(); var second = Guid.NewGuid();
        foreach (var member in new[] { first, second })
        { db.Members.Add(new() { Id = member }); db.GroupMemberships.Add(new() { Id = Guid.NewGuid(), GroupId = f.Seed.Event.GroupId, MemberId = member, Status = MembershipStatus.Approved, Role = MembershipRole.Leader }); }
        db.NotificationMessages.RemoveRange(db.NotificationMessages); await db.SaveChangesAsync();
        var p = new EventDutyProjectionService(db, f.Service);
        var duty = Assert.Single(await p.ListAsync(first, default), x => x.Task.SourceType == "eventPackage");
        Assert.Single(await p.ListAsync(second, default), x => x.Task.SourceType == "eventPackage");
        Assert.All(db.ChangeTracker.Entries(), x => Assert.Equal(EntityState.Unchanged, x.State));
        var firstDecision = await f.Service.DecideAsync(f.Seed.Event.Id, submitted.Id, first, new(EventPackageDecisionType.Approve, new("Ready", "通过")), submitted.ETag, "duty-quorum-first", default);
        Assert.True(firstDecision.IsSuccess, firstDecision.Message); Assert.Equal(EventPackageStatus.Submitted, firstDecision.Value!.Status);
        Assert.DoesNotContain(await p.ListAsync(first, default), x => x.Task.SourceType == "eventPackage");
        Assert.Single(await p.ListAsync(second, default), x => x.Task.SourceType == "eventPackage");
        Assert.False((await p.GetAsync(f.Seed.Event.Id, "eventPackage", submitted.Id, first, duty.Task.TaskKey, default)).IsSuccess);
        var completed = await f.Service.DecideAsync(f.Seed.Event.Id, submitted.Id, second, new(EventPackageDecisionType.Approve, new("Ready", "通过")), firstDecision.Value.ETag, "duty-quorum-second", default);
        Assert.True(completed.IsSuccess, completed.Message);
        Assert.DoesNotContain(await p.ListAsync(second, default), x => x.Task.SourceType == "eventPackage");
        Assert.All(await db.NotificationMessages.ToListAsync(), n => { Assert.Contains("\"title\"", n.ActionDataJson); Assert.Contains("actionUrl", n.ActionDataJson); });
    }

    [Fact]
    public async Task DutyProjection_ConditionsSeparateEvidenceFromVerification_AndDoNotDuplicateLinkedTasks()
    {
        await using var db = CreateDb(); var f = await DutyFixture(db, "TEAM.WORK");
        var worker = Guid.NewGuid(); db.Members.Add(new() { Id = worker });
        db.GroupMemberships.Add(new() { Id = Guid.NewGuid(), GroupId = f.Seed.Event.GroupId, MemberId = worker, Status = MembershipStatus.Approved });
        db.EventRoleAssignments.Add(new() { Id = Guid.NewGuid(), EventId = f.Seed.Event.Id, MemberId = worker, RoleRequirementKey = "TEAM.WORK:event.lead", Status = EventRoleAssignmentStatus.Accepted }); await db.SaveChangesAsync();
        var submitted = await SubmittedDutyPackage(f.Service, f.Seed);
        var approved = await f.Service.DecideAsync(f.Seed.Event.Id, submitted.Id, f.Seed.Owner, new(EventPackageDecisionType.ApproveWithConditions, new("Evidence", "补证据"), Conditions: [new(new("Confirm equipment", "确认设备"), EventLifecycleGate.Execute, "TEAM.WORK:event.lead", DateTime.UtcNow.AddDays(3))]), submitted.ETag, "duty-condition", default);
        Assert.True(approved.IsSuccess, approved.Message); var condition = Assert.Single(approved.Value!.Conditions);
        var p = new EventDutyProjectionService(db, f.Service);
        var evidenceDuty = Assert.Single(await p.ListAsync(worker, default), x => x.Task.SourceType == "packageCondition");
        Assert.DoesNotContain(await p.ListAsync(worker, default), x => x.Task.SourceType == "eventTask");
        var evidence = await f.Service.SatisfyConditionAsync(f.Seed.Event.Id, submitted.Id, condition.Id, worker, new("private-evidence-ref"), condition.ETag, "evidence-1", default);
        Assert.True(evidence.IsSuccess, evidence.Message);
        Assert.DoesNotContain(await p.ListAsync(worker, default), x => x.Task.SourceType == "packageCondition");
        var verify = Assert.Single(await p.ListAsync(f.Seed.Owner, default), x => x.Task.SourceType == "packageCondition");
        Assert.DoesNotContain("private-evidence-ref", verify.Task.ActionDataJson);
        Assert.False((await p.GetAsync(f.Seed.Event.Id, "packageCondition", condition.Id, worker, evidenceDuty.Task.TaskKey, default)).IsSuccess);
        var result = await f.Service.VerifyConditionAsync(f.Seed.Event.Id, submitted.Id, condition.Id, f.Seed.Owner, new(true, new("Checked", "已核验")), evidence.Value!.Condition.ETag, "verify-1", default);
        Assert.True(result.IsSuccess, result.Message);
        Assert.DoesNotContain(await p.ListAsync(f.Seed.Owner, default), x => x.Task.SourceType == "packageCondition");
        Assert.Equal(EventTaskStatus.Done, (await db.EventTasks.SingleAsync(x => x.Id == condition.ReadinessTaskId)).Status);
    }

    [Fact]
    public async Task DutyProjection_OwnerRespectsManualLifecycleChoicesAndPostEventLimits()
    {
        await using var db = CreateDb(); var f = await DutyFixture(db, "TEAM.WORK");
        f.Seed.Event.RamAssessment = new() { EventId = f.Seed.Event.Id, Status = EventRamStatus.Approved, Validity = "Valid", RamDataJson = "{}" };
        f.Seed.Event.EventDataJson = "{\"maxCapacity\":20,\"registrationDeadline\":\"" + DateTime.UtcNow.AddDays(2).ToString("O") + "\"}"; await db.SaveChangesAsync();
        var submitted = await SubmittedDutyPackage(f.Service, f.Seed);
        var approved = await f.Service.DecideAsync(f.Seed.Event.Id, submitted.Id, f.Seed.Owner, new(EventPackageDecisionType.Approve, new("Ready", "通过")), submitted.ETag, "lifecycle-approve", default);
        Assert.True(approved.IsSuccess, approved.Message); var p = new EventDutyProjectionService(db, f.Service);
        Assert.Equal("event.publish", Assert.Single(await p.ListAsync(f.Seed.Owner, default), x => x.Task.SourceType == "eventNextStep").Task.ActionType);
        f.Seed.Event.PublicationStatus = EventPublicationStatus.Unpublished; await db.SaveChangesAsync();
        Assert.DoesNotContain(await p.ListAsync(f.Seed.Owner, default), x => x.Task.ActionType == "event.publish");
        f.Seed.Event.PublicationStatus = EventPublicationStatus.Published; f.Seed.Event.RegistrationStatus = EventRegistrationStatus.Closed; await db.SaveChangesAsync();
        Assert.Contains(await p.ListAsync(f.Seed.Owner, default), x => x.Task.ActionType == "event.registration.open");
        db.AuditLogs.Add(new() { Id = Guid.NewGuid(), EventId = f.Seed.Event.Id, Action = "event.registration.closed" }); await db.SaveChangesAsync();
        Assert.DoesNotContain(await p.ListAsync(f.Seed.Owner, default), x => x.Task.ActionType == "event.registration.open");
        f.Seed.Event.EndDate = DateTime.UtcNow.AddDays(-1); await db.SaveChangesAsync();
        Assert.DoesNotContain(await p.ListAsync(f.Seed.Owner, default), x => x.Task.ActionType is "event.publish" or "event.registration.open" or "event.execution.confirm");
    }

    [Fact]
    public async Task DutyProjection_ReopeningAndOccurrenceRecoveryUseCurrentBusinessState()
    {
        await using var db = CreateDb(); var f = await DutyFixture(db, "TEAM.WORK");
        var submitted = await SubmittedDutyPackage(f.Service, f.Seed);
        var approved = await f.Service.DecideAsync(f.Seed.Event.Id, submitted.Id, f.Seed.Owner, new(EventPackageDecisionType.Approve, new("Ready", "通过")), submitted.ETag, "reopening-approve", default);
        Assert.True(approved.IsSuccess, approved.Message);
        var p = new EventDutyProjectionService(db, f.Service);
        var request = await f.Service.RequestPreparationReopenAsync(f.Seed.Event.Id, f.Seed.Owner, new(new("Revise", "修改")), "request-reopen", default);
        Assert.True(request.IsSuccess, request.Message);
        var review = Assert.Single(await p.ListAsync(f.Seed.Owner, default), x => x.Task.SourceType == "preparationReopen");
        Assert.DoesNotContain(await p.ListAsync(f.Seed.Owner, default), x => x.Task.SourceType == "eventNextStep");
        var reopened = await f.Service.ReviewPreparationReopenAsync(f.Seed.Event.Id, request.Value!.ReopenRequest!.Id, f.Seed.Owner, new(true, new("Reopen", "同意修改")), request.Value.ReopenRequest.ETag, "review-reopen", default);
        Assert.True(reopened.IsSuccess, reopened.Message);
        Assert.False((await p.GetAsync(f.Seed.Event.Id, "preparationReopen", review.Task.SourceId!.Value, f.Seed.Owner, review.Task.TaskKey, default)).IsSuccess);
        Assert.Single(await p.ListAsync(f.Seed.Owner, default), x => x.Task.SourceType == "eventNextStep");
        var occurrence = f.Seed.Occurrences[0];
        occurrence.ExceptionsJson = EventOccurrencePackageExceptionState.Raise("[]", "PLACE.RESOURCE", "venue.changed", "governanceCritical", f.Seed.Owner, DateTime.UtcNow, [submitted.Id], Guid.NewGuid(), out _); await db.SaveChangesAsync();
        var recovery = Assert.Single(await p.ListAsync(f.Seed.Owner, default), x => x.Task.SourceType == "eventNextStep");
        Assert.Equal("event.package.occurrence.revise", recovery.Task.ActionType); Assert.Equal(occurrence.Id, recovery.Task.OccurrenceId);
        occurrence.Status = EventOccurrenceStatus.Cancelled; await db.SaveChangesAsync();
        Assert.DoesNotContain(await p.ListAsync(f.Seed.Owner, default), x => x.Task.SourceType == "eventNextStep");
    }

    [Fact]
    public async Task DutyProjection_ConfirmedRosterMemberDepartureReturnsTheVacancyToOwner()
    {
        await using var db = CreateDb(); var f = await DutyFixture(db, "TEAM.WORK", "SERVICE.ROSTER");
        var worker = Guid.NewGuid(); db.Members.Add(new() { Id = worker });
        var membership = new GroupMembership { Id = Guid.NewGuid(), GroupId = f.Seed.Event.GroupId, MemberId = worker, Status = MembershipStatus.Approved };
        db.GroupMemberships.Add(membership);
        var slot = new EventServiceSlot { Id = Guid.NewGuid(), OccurrenceId = f.Seed.Occurrences[0].Id, RoleCode = "welcome", EligibilityCode = "approvedGroupMember", StartUtc = f.Seed.Event.StartDate, EndUtc = f.Seed.Event.EndDate, RequiredCount = 1 };
        db.EventServiceSlots.Add(slot);
        db.EventRosterAssignments.Add(new() { Id = Guid.NewGuid(), ServiceSlotId = slot.Id, MemberId = worker, Status = EventRosterAssignmentStatus.Confirmed });
        await db.SaveChangesAsync(); var projection = new EventDutyProjectionService(db, f.Service);
        Assert.DoesNotContain(await projection.ListAsync(f.Seed.Owner, default), x => x.Task.ActionType == "event.roster.coordinate");
        membership.Status = MembershipStatus.Removed; await db.SaveChangesAsync();
        var vacancy = Assert.Single(await projection.ListAsync(f.Seed.Owner, default), x => x.Task.SourceType == "eventNextStep");
        Assert.Equal("event.roster.coordinate", vacancy.Task.ActionType);
        Assert.Equal(slot.OccurrenceId, vacancy.Task.OccurrenceId);
        f.Seed.Occurrences[0].RosterConcurrencyToken = Guid.NewGuid(); await db.SaveChangesAsync();
        Assert.False((await projection.GetAsync(f.Seed.Event.Id, "eventNextStep", f.Seed.Event.Id, f.Seed.Owner, vacancy.Task.TaskKey, default)).IsSuccess);
    }
}
