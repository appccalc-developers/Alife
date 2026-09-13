using System.Text.Json;
using Alife.Application.Admin;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Services;

public sealed class EventDutyProjectionService(IAlifeDbContext db, IEventPackageService packages)
{
    public async Task<AppResult<EventDuty>> GetAsync(Guid eventId, string source, Guid id, Guid member, string? key, CancellationToken ct)
    {
        var duties = await ListAsync(member, ct, eventId);
        var duty = duties.FirstOrDefault(x => x.Task.SourceType == source && x.Task.SourceId == id && x.Task.TaskKey == key);
        if (duty is null) return AppResult<EventDuty>.Conflict("This responsibility was completed, changed, or is no longer available to you. / 此事务已处理、版本已改变，或你已无处理权限。");
        if (source == "roleInvitation")
        {
            var role = await db.EventRoleAssignments.AsNoTracking().FirstAsync(x => x.EventId == eventId && x.Id == id, ct);
            duty = duty with { Context = new($"Invited responsibility: {role.RoleRequirementKey}. Confirm only your own participation.", $"受邀职责：{role.RoleRequirementKey}。请由本人确认是否承担。") };
        }
        if (source == "rosterAssignment")
        {
            var slot = await db.EventRosterAssignments.AsNoTracking().Where(x => x.Id == id).Select(x => x.ServiceSlot).FirstAsync(ct);
            duty = duty with { Context = new($"Service: {slot.RoleCode}. {slot.StartUtc:yyyy-MM-dd HH:mm} – {slot.EndUtc:yyyy-MM-dd HH:mm} UTC.", $"服事岗位：{slot.RoleCode}。{slot.StartUtc:yyyy-MM-dd HH:mm} – {slot.EndUtc:yyyy-MM-dd HH:mm} UTC。") };
        }
        if (source == "sponsorship")
        {
            var e = await db.GroupEvents.AsNoTracking().FirstAsync(x => x.Id == eventId, ct);
            var decision = await db.EventApprovalDecisions.AsNoTracking().Where(x => x.EventId == eventId && x.SubjectType == "event.sponsorship" && x.Decision == EventApprovalDecisionType.Submitted).OrderByDescending(x => x.DecidedUtc).FirstOrDefaultAsync(ct);
            duty = duty with { DetailText = decision?.Reason, ETag = $"\"sponsorship-{(int)e.SponsorshipStatus}-{e.UpdatedUtc.Ticks:x}\"" };
        }
        return AppResult<EventDuty>.Success(duty);
    }

    public async Task<IReadOnlyList<EventDuty>> ListAsync(Guid member, CancellationToken ct, Guid? eventId = null)
    {
        var now = DateTime.UtcNow;
        var memberships = await db.GroupMemberships.AsNoTracking().Where(x => x.MemberId == member && x.Status == MembershipStatus.Approved).ToListAsync(ct);
        var groupIds = memberships.Select(x => x.GroupId).ToArray();
        var groups = await db.Groups.AsNoTracking().Select(x => new { x.Id, x.ParentGroupId, x.IsChurch }).ToListAsync(ct);
        Guid? Root(Guid id) { var visited = new HashSet<Guid>(); while (visited.Add(id)) { var g = groups.FirstOrDefault(x => x.Id == id); if (g is null) return null; if (g.IsChurch) return id; if (!g.ParentGroupId.HasValue) return null; id = g.ParentGroupId.Value; } return null; }
        var churchGroupIds = groups.Where(g => Root(g.Id) is { } root && groupIds.Contains(root)).Select(x => x.Id).ToArray();
        var leaderGroups = memberships.Where(x => x.Role is MembershipRole.Leader or MembershipRole.CoLeader).Select(x => x.GroupId).ToArray();
        var churchLeadershipGroups = groups.Where(g => Root(g.Id) is { } root && leaderGroups.Contains(root)).Select(x => x.Id).ToArray();
        var canAudit = await AdminPlatformRoleHelpers.HasPermissionAsync(db, member, AdminPermissionCatalog.AuditEvents, ct);
        var canApprove = await AdminPlatformRoleHelpers.HasPermissionAsync(db, member, AdminPermissionCatalog.ApproveEventPackages, ct);
        var canSponsor = await AdminPlatformRoleHelpers.HasPermissionAsync(db, member, AdminPermissionCatalog.SponsorEvents, ct);
        var delegatedEvents = await db.EventPackageApprovalDelegations.AsNoTracking().Where(x => x.DelegatedToMemberId == member && x.RevokedUtc == null && x.StartsUtc <= now && x.ExpiresUtc > now)
            .Select(x => x.OrganisationId).ToArrayAsync(ct);
        var events = await db.GroupEvents.AsNoTracking().Include(x => x.RamAssessment)
            .Where(x => (!eventId.HasValue || x.Id == eventId) &&
                (canApprove || canSponsor || delegatedEvents.Contains(x.GroupId) || churchLeadershipGroups.Contains(x.GroupId) ||
                 canAudit && churchGroupIds.Contains(x.GroupId) ||
                 groupIds.Contains(x.GroupId) && (leaderGroups.Contains(x.GroupId) || x.AccountableOwnerMemberId == member || x.AccountableOwnerMemberId == Guid.Empty && x.CreatedByMemberId == member ||
                    db.EventTeamMembers.Any(t => t.EventId == x.Id && t.MemberId == member && t.EndedUtc == null) ||
                    db.EventRoleAssignments.Any(r => r.EventId == x.Id && r.MemberId == member && r.EndedUtc == null) ||
                    db.EventTasks.Any(t => t.EventId == x.Id && (t.AssignedMemberId == member || t.ReviewerMemberId == member) && t.Status != EventTaskStatus.Done && t.Status != EventTaskStatus.Cancelled) ||
                    db.EventRosterAssignments.Any(r => r.ServiceSlot.Occurrence.EventId == x.Id && r.MemberId == member && r.EndedUtc == null))))
            .ToListAsync(ct);
        if (events.Count == 0) return [];
        var ids = events.Select(x => x.Id).ToArray();
        var occurrenceStates = await db.EventOccurrences.AsNoTracking().Where(x => ids.Contains(x.EventId)).Select(x => new { x.EventId, x.Status, x.EndUtc }).ToListAsync(ct);
        var teams = await db.EventTeamMembers.AsNoTracking().Where(x => ids.Contains(x.EventId) && x.EndedUtc == null).ToListAsync(ct);
        var participantGroups = events.Select(e => e.GroupId).Distinct().ToArray();
        var activeMemberships = await db.GroupMemberships.AsNoTracking().Where(x => participantGroups.Contains(x.GroupId) && x.Status == MembershipStatus.Approved).Select(x => new { x.GroupId, x.MemberId }).ToListAsync(ct);
        var activeMembers = activeMemberships.Select(x => (x.GroupId, x.MemberId)).ToHashSet();
        var roles = await db.EventRoleAssignments.AsNoTracking().Where(x => ids.Contains(x.EventId) && x.EndedUtc == null).ToListAsync(ct);
        var tasks = await db.EventTasks.AsNoTracking().Where(x => ids.Contains(x.EventId) && (x.AssignedMemberId == member || x.ReviewerMemberId == member) && x.Status != EventTaskStatus.Done && x.Status != EventTaskStatus.Cancelled).ToListAsync(ct);
        var conditionTasks = await db.EventPackageConditions.AsNoTracking().Where(x => ids.Contains(x.EventPackage.EventId) && x.ReadinessTaskId != null).Select(x => x.ReadinessTaskId).ToArrayAsync(ct);
        var roster = await db.EventRosterAssignments.AsNoTracking().Include(x => x.ServiceSlot).ThenInclude(x => x.Occurrence)
            .Where(x => ids.Contains(x.ServiceSlot.Occurrence.EventId) && x.MemberId == member && x.EndedUtc == null && x.Status == EventRosterAssignmentStatus.Invited).ToListAsync(ct);
        var revisions = await db.EventRamRevisions.AsNoTracking().Where(x => ids.Contains(x.EventId) && db.EventRamAssessments.Any(r => r.EventId == x.EventId && r.CurrentRevisionId == x.Id)).ToListAsync(ct);
        var plans = await db.EventPlanSnapshots.AsNoTracking().Where(x => ids.Contains(x.EventId) && x.IsActive).ToListAsync(ct);
        var frozenIds = await db.EventPackages.AsNoTracking().Where(x => ids.Contains(x.EventId) && x.ScopeType == EventPackageScopeType.Event &&
            (x.Status == EventPackageStatus.Approved || x.Status == EventPackageStatus.ApprovedWithConditions) && x.ApprovalValidityStatus != EventPackageApprovalValidity.Revoked).Select(x => x.EventId).ToArrayAsync(ct);
        var result = new List<EventDuty>();
        foreach (var e in events)
        {
            var approved = groupIds.Contains(e.GroupId);
            var owner = approved && (e.AccountableOwnerMemberId == Guid.Empty ? e.CreatedByMemberId : e.AccountableOwnerMemberId) == member;
            var ownRoles = roles.Where(x => x.EventId == e.Id && x.MemberId == member).ToArray();
            bool Participant(Guid? id) => id.HasValue && EventDutyAccess.IsTaskParticipant(activeMembers.Contains((e.GroupId, id.Value)),
                (e.AccountableOwnerMemberId == Guid.Empty ? e.CreatedByMemberId : e.AccountableOwnerMemberId) == id,
                teams.Any(x => x.EventId == e.Id && x.MemberId == id && x.Status == EventTeamMemberStatus.Accepted),
                roles.Any(x => x.EventId == e.Id && x.MemberId == id && x.Status == EventRoleAssignmentStatus.Accepted));
            var accepted = Participant(member);
            void Add(string source, Guid id, string version, string action, string en, string zh, string surface, DateTime created, DateTime? due = null, Guid? occurrence = null, string? target = null)
                => result.Add(EventDutyFactory.Create(e, member, source, id, version, action, en, zh, surface, created, due, occurrence, target));
            var eventOccurrences = occurrenceStates.Where(x => x.EventId == e.Id).ToArray();
            var cancelled = eventOccurrences.Length > 0 && eventOccurrences.All(x => x.Status == EventOccurrenceStatus.Cancelled);
            var ongoing = !cancelled && (e.EventSeriesId.HasValue ? eventOccurrences.Any(x => x.Status != EventOccurrenceStatus.Cancelled && x.EndUtc >= now) : e.EndDate >= now);
            if (approved && ongoing)
            {
                foreach (var invite in teams.Where(x => x.EventId == e.Id && x.MemberId == member && x.Status == EventTeamMemberStatus.Invited))
                    Add("teamInvitation", invite.Id, invite.UpdatedUtc.Ticks.ToString(), "event.team.respond", "Respond to team invitation", "回应活动团队邀请", "invitation", invite.CreatedUtc);
                foreach (var role in ownRoles.Where(x => x.Status == EventRoleAssignmentStatus.Invited && !x.RoleRequirementKey.EndsWith(":event.accountableOwner")))
                    Add("roleInvitation", role.Id, role.UpdatedUtc.Ticks.ToString(), "event.role.respond", "Respond to role invitation", "回应活动职责邀请", "invitation", role.CreatedUtc);
                foreach (var assignment in roster.Where(x => x.ServiceSlot.Occurrence.EventId == e.Id && x.ServiceSlot.Occurrence.Status != EventOccurrenceStatus.Cancelled && x.ServiceSlot.EndUtc >= now &&
                    EventDutyAccess.IsRosterEligible(x.ServiceSlot.EligibilityCode, approved, accepted, ownRoles.Where(r => r.Status == EventRoleAssignmentStatus.Accepted).Select(r => r.RoleRequirementKey))))
                    Add("rosterAssignment", assignment.Id, assignment.UpdatedUtc.Ticks.ToString(), "event.roster.respond", $"Confirm service: {assignment.ServiceSlot.RoleCode}", $"确认服事安排：{assignment.ServiceSlot.RoleCode}", "rosterInvitation", assignment.CreatedUtc, assignment.ServiceSlot.StartUtc, assignment.ServiceSlot.OccurrenceId);
            }
            if (accepted)
                foreach (var task in tasks.Where(x => x.EventId == e.Id && x.SourceType == null && !conditionTasks.Contains(x.Id)))
                {
                    var review = task.ApprovalStatus == EventTaskApprovalStatus.PendingReview;
                    if (review ? task.ReviewerMemberId != member || task.AssignedMemberId == member || !Participant(task.AssignedMemberId) : task.AssignedMemberId != member) continue;
                    Add("eventTask", task.Id, task.ConcurrencyToken.ToString("N"), review ? "event.task.review" : "event.task.complete",
                        review ? $"Review task: {task.TitleEn}" : task.TitleEn, review ? $"审核任务：{task.TitleZh}" : task.TitleZh, "task", task.UpdatedUtc, task.DueUtc);
                }
            EventPlanProposalDto? plan = null;
            try { var saved = plans.Where(x => x.EventId == e.Id).OrderByDescending(x => x.Version).FirstOrDefault(); if (saved is not null) plan = EventCompositionPersistence.ToSnapshotDto(saved).Plan; }
            catch (JsonException) { /* Broken plans are owner coordination work, never fabricated approvals. */ }
            var ram = e.RamAssessment;
            var revision = revisions.FirstOrDefault(x => x.EventId == e.Id);
            var authorRole = ownRoles.Any(x => x.Status == EventRoleAssignmentStatus.Accepted && EventDutyAccess.IsRamAuthorRole(x.RoleRequirementKey));
            var otherAuthor = roles.Any(x => x.EventId == e.Id && x.MemberId != member && x.Status == EventRoleAssignmentStatus.Accepted && Participant(x.MemberId) && EventDutyAccess.IsRamAuthorRole(x.RoleRequirementKey));
            var ramRequired = plan is not null && EventRamGovernanceService.IsRequired(e, plan);
            if (!frozenIds.Contains(e.Id))
            {
                var canAuthor = accepted && (authorRole || owner && (!otherAuthor || ram?.AuthorMemberId == member));
                if (canAuthor && (ram is not null || ramRequired) && (ram is null || ram.Validity is "Draft" or "Returned" or "ReviewRequired" or "Confirmed"))
                    Add("ramAssessment", e.Id, ram?.ConcurrencyToken.ToString("N") ?? e.PlanConcurrencyToken.ToString("N"), ram?.Validity == "Confirmed" ? "event.ram.submit" : "event.ram.author",
                        ram?.Validity == "Confirmed" ? "Submit confirmed RAM" : "Prepare or revise RAM", ram?.Validity == "Confirmed" ? "提交已确认的 RAM" : "起草或修改 RAM", "ram", ram?.UpdatedUtc ?? e.UpdatedUtc,
                        tasks.Where(x => x.EventId == e.Id && x.SourceType == "ramAssessment" && x.AssignedMemberId == member).Select(x => x.DueUtc).Min());
                if (approved && ongoing && ram?.Validity == "AwaitingConfirmation" && revision?.OnsiteMemberId == member && (revision.AuthorMemberId == member && canAuthor || ownRoles.Any(x => x.Status == EventRoleAssignmentStatus.Accepted)))
                    Add("ramRevision", revision.Id, revision.Id.ToString("N"), "event.ram.confirm", "Confirm on-site RAM responsibilities", "确认 RAM 现场职责", "ram", revision.CreatedUtc);
                if (ram?.Validity == "AwaitingReview" && ram.Status == EventRamStatus.AwaitingReview && revision is not null && canAudit && Root(e.GroupId) is { } root && groupIds.Contains(root) &&
                    EventDutyAccess.IsIndependentRamReviewer(member, revision.AuthorMemberId, revision.OnsiteMemberId, ram.SubmittedByMemberId))
                    Add("ramRevision", revision.Id, revision.Id.ToString("N"), "event.ram.reviewRequested", "Independent RAM review", "RAM 独立审核", "ram", ram.SubmittedUtc ?? revision.CreatedUtc);
            }
            if (e.SponsorshipStatus == EventSponsorshipStatus.Pending && (canSponsor || Root(e.GroupId) is { } church && memberships.Any(x => x.GroupId == church && x.Role is MembershipRole.Leader or MembershipRole.CoLeader)))
                Add("sponsorship", e.Id, e.UpdatedUtc.Ticks.ToString(), "event.sponsorship.decide", "Review church sponsorship", "审核教会身份申请", "sponsorship", e.UpdatedUtc);
        }
        result.AddRange(await packages.ListDutiesAsync(member, events, ct));
        return result.DistinctBy(x => x.Task.TaskKey).OrderBy(x => x.Task.DueUtc ?? DateTime.MaxValue).ThenByDescending(x => x.Task.OccurredUtc).ToArray();
    }
}
