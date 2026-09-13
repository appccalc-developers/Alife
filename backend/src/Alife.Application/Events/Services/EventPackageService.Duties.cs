using System.Text.Json;
using Alife.Application.Events.Dtos;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Services;

public sealed partial class EventPackageService
{
    // Read-only projection: deliberately does not call the GET paths which persist expiry.
    public async Task<IReadOnlyList<EventDuty>> ListDutiesAsync(Guid memberId, IReadOnlyList<GroupEvent> events, CancellationToken ct)
    {
        var ids = events.Select(x => x.Id).ToArray();
        var now = DateTime.UtcNow;
        var packages = await PackageQuery(asNoTracking: true).Where(x => ids.Contains(x.EventId)).ToListAsync(ct);
        var roles = await db.EventRoleAssignments.AsNoTracking().Where(x => ids.Contains(x.EventId) && x.EndedUtc == null && x.Status == EventRoleAssignmentStatus.Accepted).ToListAsync(ct);
        var invitedRoles = await db.EventRoleAssignments.AsNoTracking().Where(x => ids.Contains(x.EventId) && x.EndedUtc == null && x.Status == EventRoleAssignmentStatus.Invited).ToListAsync(ct);
        var reopens = await db.EventPreparationReopenRequests.AsNoTracking().Where(x => ids.Contains(x.EventId) && x.Status == EventPreparationReopenStatus.Pending).ToListAsync(ct);
        var occurrences = await db.EventOccurrences.AsNoTracking().Where(x => ids.Contains(x.EventId)).ToListAsync(ct);
        var slots = await db.EventServiceSlots.AsNoTracking().Include(x => x.Assignments).Where(x => ids.Contains(x.Occurrence.EventId)).ToListAsync(ct);
        var plans = await db.EventPlanSnapshots.AsNoTracking().Where(x => ids.Contains(x.EventId) && x.IsActive).ToListAsync(ct);
        var policies = await db.EventPackageGovernancePolicyVersions.AsNoTracking().Where(x => x.IsPublished && x.EffectiveFromUtc <= now && (x.RetiredUtc == null || x.RetiredUtc > now)).ToListAsync(ct);
        var allTeams = await db.EventTeamMembers.AsNoTracking().Where(x => ids.Contains(x.EventId) && x.Status == EventTeamMemberStatus.Accepted && x.EndedUtc == null).ToListAsync(ct);
        var relevantGroups = events.Select(x => x.GroupId).Distinct().ToArray();
        var memberPairs = await db.GroupMemberships.AsNoTracking().Where(x => relevantGroups.Contains(x.GroupId) && x.Status == MembershipStatus.Approved).Select(x => new { x.GroupId, x.MemberId }).ToListAsync(ct);
        var activeMembers = memberPairs.Select(x => (x.GroupId, x.MemberId)).ToHashSet();
        var ordinaryTasks = await db.EventTasks.AsNoTracking().Where(x => ids.Contains(x.EventId) && x.SourceType == null && x.Status != EventTaskStatus.Done && x.Status != EventTaskStatus.Cancelled && !db.EventPackageConditions.Any(c => c.ReadinessTaskId == x.Id)).ToListAsync(ct);
        var lifecycleAudits = await db.AuditLogs.AsNoTracking().Where(x => x.EventId != null && ids.Contains(x.EventId.Value) && (x.Action == "event.registration.closed" || x.Action == "event.registration.opened" || x.Action == "event.unpublished" || x.Action == "event.published" || x.Action == "event.preparation.reopen.review" || x.Action == "event.package.invalidated")).Select(x => new { x.EventId, x.Action, x.OccurredUtc }).ToListAsync(ct);
        var duties = new List<EventDuty>();
        foreach (var e in events)
        {
            var access = await LoadViewableEvent(e.Id, memberId, ct);
            if (!access.IsSuccess) continue;
            var owner = await CanManageEventForDuties(e, memberId, ct);
            bool Participant(Guid? id) => id.HasValue && EventDutyAccess.IsTaskParticipant(activeMembers.Contains((e.GroupId, id.Value)), id == EventDutyAccess.OwnerId(e), allTeams.Any(t => t.EventId == e.Id && t.MemberId == id), roles.Any(r => r.EventId == e.Id && r.MemberId == id));
            var mine = roles.Where(x => x.EventId == e.Id && x.MemberId == memberId && activeMembers.Contains((e.GroupId, memberId))).Select(x => x.RoleRequirementKey).ToHashSet();
            var eventPackages = packages.Where(x => x.EventId == e.Id).ToArray();
            var latest = eventPackages.GroupBy(x => (x.ScopeType, x.ScopeId)).Select(x => x.OrderByDescending(p => p.Version).First()).ToArray();
            var baseline = latest.FirstOrDefault(x => x.ScopeType == EventPackageScopeType.Event);
            var policy = policies.Where(x => x.OrganisationId == e.GroupId || x.OrganisationId == null).OrderByDescending(x => x.OrganisationId == e.GroupId).ThenByDescending(x => x.EffectiveFromUtc).FirstOrDefault();
            var frozen = eventPackages.Where(x => x.ScopeType == EventPackageScopeType.Event && x.Status is EventPackageStatus.Approved or EventPackageStatus.ApprovedWithConditions && x.ApprovalValidityStatus != EventPackageApprovalValidity.Revoked).OrderByDescending(x => x.Version).FirstOrDefault();
            var cancelled = occurrences.Any(x => x.EventId == e.Id) && occurrences.Where(x => x.EventId == e.Id).All(x => x.Status == EventOccurrenceStatus.Cancelled);
            var ownerPriority = int.MaxValue;
            void Add(string source, Guid id, string version, string action, string en, string zh, string surface, DateTime created, DateTime? due = null, Guid? occurrence = null, string? target = null)
                => duties.Add(EventDutyFactory.Create(e, memberId, source, id, version, action, en, zh, surface, created, due, occurrence, target));
            void OwnerStep(string action, string en, string zh, string target, Guid? occurrence = null, DateTime? due = null)
            {
                var priority = action is "event.preparation.reopen" or "event.preparation.revise" or "event.package.revise" or "event.package.condition.recover" or "event.package.occurrence.revise" ? 0
                    : action == "event.package.submit" ? 20 : action == "event.publish" ? 30 : action == "event.registration.open" ? 40 : action == "event.execution.confirm" ? 50 : 10;
                if (!owner || cancelled && action != "event.tasks.coordinate" || priority >= ownerPriority) return;
                duties.RemoveAll(d => d.Task.EventId == e.Id && d.Task.SourceType == "eventNextStep");
                ownerPriority = priority;
                var scoped = occurrences.FirstOrDefault(x => x.Id == occurrence);
                Add("eventNextStep", e.Id, $"{e.PlanConcurrencyToken:N}:{baseline?.ConcurrencyToken:N}:{frozen?.ConcurrencyToken:N}:{e.PublicationConcurrencyToken:N}:{e.RegistrationConcurrencyToken:N}:{e.ExecutionConcurrencyToken:N}:{occurrence:N}:{scoped?.RosterConcurrencyToken:N}:{scoped?.ExecutionConcurrencyToken:N}:{scoped?.UpdatedUtc.Ticks}", action,
                    en, zh, "owner", e.UpdatedUtc, due, occurrence, target);
            }
            string Workspace(string stage = "arrangements") => $"/events/{e.Id}/workspace?flow=setup&stage={stage}";
            var captures = new Dictionary<Guid, PackageCapture?>();
            async Task<bool> Fresh(EventPackage p)
            {
                if (!captures.TryGetValue(p.Id, out var capture))
                {
                    try { var result = await CaptureAsync(e.Id, new(p.ScopeType, p.ScopeId, p.PackageSchemaVersion), ct); capture = result.IsSuccess ? result.Value : null; }
                    catch (JsonException) { capture = null; }
                    captures[p.Id] = capture;
                }
                return capture is not null && capture.SourceVectorHash == p.SourceVectorHash && capture.Plan.PlanVersion == p.EventPlanVersion && capture.Policy.Id == p.GovernancePolicyVersionId;
            }
            foreach (var p in latest)
            {
                if (p.ScopeType == EventPackageScopeType.Occurrence && !occurrences.Any(x => x.Id == p.ScopeId && x.Status != EventOccurrenceStatus.Cancelled)) continue;
                var authority = await ResolveDecisionAuthorityAsync(e, p, memberId, ct);
                if (p.Status == EventPackageStatus.Submitted)
                {
                    if (!await Fresh(p)) OwnerStep("event.package.revise", "Revise and resubmit changed preparation", "修订并重新提交已变化的方案", Workspace("approval"), p.ScopeId);
                    else if (authority.Allowed && !p.Decisions.Any(x => x.ActorMemberId == memberId && x.DecisionType is EventPackageDecisionType.Approve or EventPackageDecisionType.ApproveWithConditions &&
                        x.InvalidatedReasonCode == null && (x.ExpiresUtc == null || x.ExpiresUtc > now) && !p.Decisions.Any(r => r.RevokedByDecisionId == x.Id)))
                        Add("eventPackage", p.Id, p.ConcurrencyToken.ToString("N"), "event.package.decide", "Review Event Package", "审核活动方案", "package", p.SubmittedUtc ?? p.GeneratedUtc, occurrence: p.ScopeId);
                }
                if (p.Status == EventPackageStatus.ApprovedWithConditions && EventPackageGateEvaluator.HasValidApproval(p, now))
                    foreach (var condition in p.Conditions.Where(x => x.Status is not (EventPackageConditionStatus.Verified or EventPackageConditionStatus.Waived)))
                    {
                        if (condition.DueUtc <= now)
                        {
                            OwnerStep("event.package.condition.recover", "Resolve expired approval conditions", "处理已过期的审批条件", Workspace("approval"), p.ScopeId);
                            continue;
                        }
                        var owns = mine.Contains(condition.OwnerRoleRequirementKey);
                        if (owns && condition.Status is EventPackageConditionStatus.Open or EventPackageConditionStatus.Rejected)
                            Add("packageCondition", condition.Id, condition.ConcurrencyToken.ToString("N"), "event.package.condition.satisfy", "Provide condition evidence", "补充审批条件证据", "condition", p.GeneratedUtc, condition.DueUtc, p.ScopeId, p.Id.ToString());
                        if (authority.Allowed && condition.Status == EventPackageConditionStatus.EvidenceSubmitted && (p.GovernanceTier == EventGovernanceTier.Light || condition.SatisfiedByMemberId != memberId))
                            Add("packageCondition", condition.Id, condition.ConcurrencyToken.ToString("N"), "event.package.condition.verify", "Verify condition evidence", "核验审批条件证据", "condition", p.GeneratedUtc, condition.DueUtc, p.ScopeId, p.Id.ToString());
                    }
            }
            foreach (var reopen in reopens.Where(x => x.EventId == e.Id))
            {
                var p = eventPackages.FirstOrDefault(x => x.Id == reopen.EventPackageId);
                if (p is not null && (await ResolveDecisionAuthorityAsync(e, p, memberId, ct)).Allowed && (p.GovernanceTier == EventGovernanceTier.Light || reopen.RequestedByMemberId != memberId))
                    Add("preparationReopen", reopen.Id, reopen.ConcurrencyToken.ToString("N"), "event.preparation.reopen.review", "Review preparation reopening", "审核重新开放编辑申请", "reopen", reopen.RequestedUtc, target: p.Id.ToString());
            }
            if (reopens.Any(x => x.EventId == e.Id)) continue;
            if (frozen is not null && (!EventPackageGateEvaluator.HasValidApproval(frozen, now) || !await Fresh(frozen)))
            {
                if (!reopens.Any(x => x.EventId == e.Id)) OwnerStep("event.preparation.reopen", "Resolve invalid approval and reopen preparation", "处理失效审批并申请重新编辑", Workspace("approval"));
                continue;
            }
            if (ordinaryTasks.Any(t => t.EventId == e.Id && (!Participant(t.AssignedMemberId) || t.RequiresApproval && (!Participant(t.ReviewerMemberId ?? (EventDutyAccess.OwnerId(e) != t.AssignedMemberId ? EventDutyAccess.OwnerId(e) : null)) || t.ReviewerMemberId == t.AssignedMemberId))))
                OwnerStep("event.tasks.coordinate", "Assign task executors and independent reviewers", "安排任务执行人与独立审核人", $"/events/{e.Id}/workspace/team");
            var eventOccurrences = occurrences.Where(x => x.EventId == e.Id && x.Status != EventOccurrenceStatus.Cancelled && x.EndUtc >= now).ToArray();
            var eventEnded = cancelled || (e.EventSeriesId.HasValue ? eventOccurrences.Length == 0 : e.EndDate < now);
            foreach (var occurrence in eventOccurrences.Where(x => EventOccurrencePackageExceptionState.HasOpen(x.ExceptionsJson)))
            {
                var scoped = latest.FirstOrDefault(x => x.ScopeType == EventPackageScopeType.Occurrence && x.ScopeId == occurrence.Id);
                if (scoped?.Status != EventPackageStatus.Submitted)
                    OwnerStep("event.package.occurrence.revise", "Review changed occurrence preparation", "复查发生重大变化的场次", $"/events/{e.Id}/workspace?tab=governance&occurrenceId={occurrence.Id}", occurrence.Id);
            }
            bool EligibleForSlot(EventServiceSlot slot, Guid actor) => EventDutyAccess.IsRosterEligible(slot.EligibilityCode,
                activeMembers.Contains((e.GroupId, actor)), Participant(actor), roles.Where(r => r.EventId == e.Id && r.MemberId == actor).Select(r => r.RoleRequirementKey));
            var missingSlot = slots.FirstOrDefault(x => eventOccurrences.Any(o => o.Id == x.OccurrenceId) && x.EndUtc >= now &&
                x.Assignments.Count(a => a.Status == EventRosterAssignmentStatus.Confirmed && a.EndedUtc == null && EligibleForSlot(x, a.MemberId)) < x.RequiredCount &&
                !x.Assignments.Any(a => a.Status == EventRosterAssignmentStatus.Invited && a.EndedUtc == null && EligibleForSlot(x, a.MemberId)));
            if (!eventEnded && missingSlot is not null && frozen is null && (owner || mine.Any(x => x.EndsWith(":roster.coordinator"))))
            {
                if (owner) OwnerStep("event.roster.coordinate", "Fill required service positions", "补齐必要服事岗位", Workspace(), missingSlot.OccurrenceId);
                else Add("rosterCoordination", missingSlot.OccurrenceId, occurrences.Single(x => x.Id == missingSlot.OccurrenceId).RosterConcurrencyToken.ToString("N"), "event.roster.coordinate", "Fill required service positions", "补齐必要服事岗位", "roster", e.UpdatedUtc, occurrence: missingSlot.OccurrenceId);
            }
            EventPlanProposalDto? plan = null;
            try { var saved = plans.Where(x => x.EventId == e.Id).OrderByDescending(x => x.Version).FirstOrDefault(); if (saved is not null) plan = EventCompositionPersistence.ToSnapshotDto(saved).Plan; } catch (JsonException) { }
            if (!eventEnded && frozen is null && owner && plan is not null && plan.RoleRequirements.Any(requirement => requirement.Minimum > roles.Count(r => r.EventId == e.Id && r.RoleRequirementKey == requirement.RequirementKey && activeMembers.Contains((e.GroupId, r.MemberId))) &&
                !invitedRoles.Any(r => r.EventId == e.Id && r.RoleRequirementKey == requirement.RequirementKey && activeMembers.Contains((e.GroupId, r.MemberId)))))
                OwnerStep("event.roles.coordinate", "Fill required Event responsibilities", "补齐必要活动职责", Workspace());
            if ((!eventEnded || baseline is not null) && frozen is null && owner && e.PublicationStatus != EventPublicationStatus.LegacyImplicit)
            {
                if (plan is null || EventPreparationPolicy.NeedsPlanReview(e, plan) || EventCompositionEngine.FormalSubmissionModuleBlockers(plan).Count > 0)
                    OwnerStep("event.preparation.complete", "Complete Event preparation", "完善活动方案与安排", Workspace());
                else if (baseline?.Status is EventPackageStatus.ReturnedForAmendment or EventPackageStatus.Rejected)
                    OwnerStep("event.preparation.revise", "Revise the returned Event preparation", "修改退回的活动方案", Workspace());
                else if (EventRamGovernanceService.IsRequired(e, plan) && (e.RamAssessment?.Status != EventRamStatus.Approved || e.RamAssessment is { SchemaVersion: 2, Validity: not "Valid" }))
                {
                    // RAM authors/signers/reviewers own the next action; do not duplicate their work here.
                }
                else if (baseline is null || baseline.ApprovalValidityStatus == EventPackageApprovalValidity.Revoked || baseline.Status is EventPackageStatus.Draft or EventPackageStatus.Withdrawn or EventPackageStatus.Superseded)
                    OwnerStep("event.package.submit", "Generate and submit Event approval", "生成并提交活动审批", Workspace("approval"));
            }
            if (eventEnded) continue;
            if (baseline is null || !EventPackageGateEvaluator.HasValidApproval(baseline, now) || !await Fresh(baseline)) continue;
            var manualUnpublish = lifecycleAudits.Where(x => x.EventId == e.Id && x.Action is "event.unpublished" or "event.published").OrderByDescending(x => x.OccurredUtc).FirstOrDefault()?.Action == "event.unpublished";
            var systemWithdrawal = lifecycleAudits.Any(x => x.EventId == e.Id && x.Action is "event.preparation.reopen.review" or "event.package.invalidated");
            var manuallyClosed = lifecycleAudits.Where(x => x.EventId == e.Id && x.Action is "event.registration.closed" or "event.registration.opened").OrderByDescending(x => x.OccurredUtc).FirstOrDefault()?.Action == "event.registration.closed";
            if (owner && (e.PublicationStatus == EventPublicationStatus.Draft || e.PublicationStatus == EventPublicationStatus.Unpublished && !manualUnpublish && systemWithdrawal) &&
                e.RamAssessment?.Status == EventRamStatus.Approved &&
                (e.GovernanceMode != EventGovernanceMode.ChurchSponsored || e.SponsorshipStatus == EventSponsorshipStatus.Approved) &&
                EventPackageGateEvaluator.Evaluate(EventLifecycleGate.Publish, policy?.EnforcementMode ?? EventPackageEnforcementMode.Off, baseline, now).RequirementsSatisfied)
                OwnerStep("event.publish", "Prepare and publish the Event", "准备并发布活动", Workspace("publish"));
            if (owner && e.PublicationStatus == EventPublicationStatus.Published && e.RegistrationStatus == EventRegistrationStatus.Closed && !manuallyClosed &&
                EventLifecyclePolicy.CanOpenRegistration(e, now, out _) && EventPackageGateEvaluator.Evaluate(EventLifecycleGate.Registration, policy?.EnforcementMode ?? EventPackageEnforcementMode.Off, baseline, now).RequirementsSatisfied)
                OwnerStep("event.registration.open", "Open Event registration", "开放活动报名", $"/events/{e.Id}/workspace?tab=governance");
            if (policy is null || !activeMembers.Contains((e.GroupId, memberId)) || !await CanConfirmExecutionAsync(e, memberId, ct)) continue;
            PolicyRules? rules;
            try { rules = JsonSerializer.Deserialize<PolicyRules>(policy.RulesJson, JsonOptions); } catch (JsonException) { continue; }
            if (rules is null || rules.PreEventConfirmationWindowHours <= 0) continue;
            var scopes = e.EventSeriesId.HasValue ? eventOccurrences : [new EventOccurrence { Id = Guid.Empty, EventId = e.Id, StartUtc = e.StartDate, EndUtc = e.EndDate, ExecutionStatus = e.ExecutionStatus }];
            foreach (var scope in scopes.OrderBy(x => x.StartUtc))
            {
                if (scope.ExecutionStatus == EventExecutionStatus.Confirmed || now < scope.StartUtc.AddHours(-rules.PreEventConfirmationWindowHours) || now > scope.EndUtc || EventOccurrencePackageExceptionState.HasOpen(scope.ExceptionsJson)) continue;
                var p = latest.FirstOrDefault(x => x.ScopeType == EventPackageScopeType.Occurrence && x.ScopeId == scope.Id) ?? baseline;
                if (!EventPackageGateEvaluator.Evaluate(EventLifecycleGate.Execute, policy.EnforcementMode, p, now).RequirementsSatisfied || !await IsPackageFreshForExecutionScopeAsync(p,
                    scope.Id == Guid.Empty ? EventPackageScopeType.Event : EventPackageScopeType.Occurrence, scope.Id == Guid.Empty ? null : scope.Id, ct)) continue;
                if (owner) OwnerStep("event.execution.confirm", "Confirm readiness to proceed", "确认活动可以执行", $"/events/{e.Id}/workspace?tab=governance&occurrenceId={(scope.Id == Guid.Empty ? "" : scope.Id)}", scope.Id == Guid.Empty ? null : scope.Id, scope.StartUtc);
                else Add("execution", scope.Id == Guid.Empty ? e.Id : scope.Id, p.ConcurrencyToken.ToString("N"), "event.execution.confirm", "Confirm readiness to proceed", "确认活动可以执行", "package", e.UpdatedUtc, scope.StartUtc, scope.Id == Guid.Empty ? null : scope.Id, p.Id.ToString());
            }
        }
        return duties;
    }

    private async Task<bool> CanManageEventForDuties(GroupEvent e, Guid member, CancellationToken ct)
        => await authorization.IsApprovedMemberAsync(e.GroupId, member, ct) && await EventCompositionPersistence.CanManageEventAsync(db, authorization, e, member, ct);

}
