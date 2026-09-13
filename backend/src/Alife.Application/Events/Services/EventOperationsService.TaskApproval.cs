using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Services;

public sealed partial class EventOperationsService
{
    private async Task<bool> EligibleTaskMember(GroupEvent e, Guid member, CancellationToken ct)
        => EventDutyAccess.IsTaskParticipant(await authorization.IsApprovedMemberAsync(e.GroupId, member, ct),
            EventDutyAccess.OwnerId(e) == member,
            await db.EventTeamMembers.AnyAsync(x => x.EventId == e.Id && x.MemberId == member && x.Status == EventTeamMemberStatus.Accepted && x.EndedUtc == null, ct),
            await db.EventRoleAssignments.AnyAsync(x => x.EventId == e.Id && x.MemberId == member && x.Status == EventRoleAssignmentStatus.Accepted && x.EndedUtc == null, ct));

    private async Task<bool> IsSystemTask(EventTask task, CancellationToken ct)
        => task.SourceType != null || await db.EventPackageConditions.AnyAsync(x => x.ReadinessTaskId == task.Id, ct);

    public async Task<AppResult<EventTaskDetailDto>> GetTaskAsync(Guid eventId, Guid taskId, Guid member, CancellationToken ct)
    {
        var task = await TaskQuery(eventId).AsNoTracking().Include(x => x.ApprovalActions).FirstOrDefaultAsync(x => x.Id == taskId, ct);
        if (task is null) return AppResult<EventTaskDetailDto>.NotFound("Task not found.");
        var manager = await CanManage(task.Event, member, ct);
        var eligible = await EligibleTaskMember(task.Event, member, ct);
        if (!eligible || (!manager && task.AssignedMemberId != member && task.ReviewerMemberId != member))
            return AppResult<EventTaskDetailDto>.Forbidden("This task is limited to its current assignee, reviewer and owner.");
        var system = await IsSystemTask(task, ct);
        var pending = task.ApprovalStatus == EventTaskApprovalStatus.PendingReview;
        var active = task.Status is not (EventTaskStatus.Done or EventTaskStatus.Cancelled);
        var ownerId = EventDutyAccess.OwnerId(task.Event);
        var participants = manager ? await db.Members.AsNoTracking().Where(m =>
            db.GroupMemberships.Any(g => g.GroupId == task.Event.GroupId && g.MemberId == m.Id && g.Status == MembershipStatus.Approved) &&
            (m.Id == ownerId ||
             db.EventTeamMembers.Any(t => t.EventId == eventId && t.MemberId == m.Id && t.Status == EventTeamMemberStatus.Accepted && t.EndedUtc == null) ||
             db.EventRoleAssignments.Any(r => r.EventId == eventId && r.MemberId == m.Id && r.Status == EventRoleAssignmentStatus.Accepted && r.EndedUtc == null)))
            .Select(m => new EventTaskParticipantDto(m.Id, m.DisplayName ?? "")).ToArrayAsync(ct) : [];
        return AppResult<EventTaskDetailDto>.Success(new(ToTaskDto(task), task.ApprovalActions.OrderBy(x => x.CreatedUtc)
            .Select(x => new EventTaskApprovalActionDto(x.Id, x.Round, x.Action, x.ActorMemberId, x.ReviewerMemberId, x.SnapshotJson, x.Reason, x.CreatedUtc)).ToArray(),
            manager, !system && active && task.RequiresApproval && !pending && task.AssignedMemberId == member,
            !system && pending && task.AssignedMemberId == member,
            !system && pending && task.ReviewerMemberId == member && task.AssignedMemberId != member && task.AssignedMemberId.HasValue && await EligibleTaskMember(task.Event, task.AssignedMemberId.Value, ct), participants));
    }

    public async Task<AppResult<EventTaskDetailDto>> ActOnTaskAsync(Guid eventId, Guid taskId, Guid member,
        string action, EventTaskApprovalRequest request, string? ifMatch, string? key, CancellationToken ct)
    {
        if (action is not ("submit-completion" or "withdraw-completion" or "approve" or "return"))
            return AppResult<EventTaskDetailDto>.Validation("Unknown task action.");
        if (string.IsNullOrWhiteSpace(key) || key.Length is < 8 or > 120 || request.Reason is null || request.Reason.Length > 2000)
            return AppResult<EventTaskDetailDto>.Validation("An 8–120 character Idempotency-Key and a reason of at most 2,000 characters are required.");
        await using var tx = await db.BeginSerializableTransactionAsync(ct);
        var task = await TaskQuery(eventId).Include(x => x.ApprovalActions).FirstOrDefaultAsync(x => x.Id == taskId, ct);
        if (task is null) return AppResult<EventTaskDetailDto>.NotFound("Task not found.");
        if (!await EligibleTaskMember(task.Event, member, ct) || (task.AssignedMemberId != member && task.ReviewerMemberId != member))
            return AppResult<EventTaskDetailDto>.Forbidden("Current task responsibility is required.");
        if (await IsSystemTask(task, ct)) return AppResult<EventTaskDetailDto>.Conflict("Use the authoritative specialist action for this task.");
        var operation = $"event.task.{action}";
        var hash = EventPackageCanonicalizer.HashCanonical(new { eventId, taskId, member, action, request, ifMatch });
        var replay = await db.EventIdempotencyRecords.AsNoTracking().FirstOrDefaultAsync(x => x.Operation == operation && x.ScopeId == taskId && x.Key == key, ct);
        if (replay is not null) return replay.RequestHash == hash ? await GetTaskAsync(eventId, taskId, member, ct)
            : AppResult<EventTaskDetailDto>.Conflict("Idempotency key was used for a different request.");
        if (!Matches(ifMatch, TaskETag(task))) return AppResult<EventTaskDetailDto>.PreconditionFailed("The task changed; reload the current version.");
        if (!task.RequiresApproval || task.Status is EventTaskStatus.Done or EventTaskStatus.Cancelled)
            return AppResult<EventTaskDetailDto>.Conflict("This task is not awaiting completion or approval.");
        var pending = task.ApprovalStatus == EventTaskApprovalStatus.PendingReview;
        if (action == "submit-completion")
        {
            if (task.AssignedMemberId != member) return AppResult<EventTaskDetailDto>.Forbidden("Only the assignee can submit completion.");
            if (pending) return AppResult<EventTaskDetailDto>.Conflict("Completion is already awaiting review.");
            var owner = task.Event.AccountableOwnerMemberId == Guid.Empty ? task.Event.CreatedByMemberId : task.Event.AccountableOwnerMemberId;
            var reviewer = task.ReviewerMemberId ?? (owner != member ? owner : (Guid?)null);
            if (reviewer is null || reviewer == member || !await EligibleTaskMember(task.Event, reviewer.Value, ct))
                return AppResult<EventTaskDetailDto>.Conflict("Ask the Event owner to select an eligible, independent reviewer. / 请活动负责人指定合资格的独立审核人。");
            if (task.Dependencies.Any(x => x.DependsOnEventTask.Status != EventTaskStatus.Done) || task.Blockers.Any(x => x.ResolvedUtc == null))
                return AppResult<EventTaskDetailDto>.Conflict("Resolve task blockers and complete prerequisites before submission.");
            task.ReviewerMemberId = reviewer;
            task.ApprovalRound++;
            task.ApprovalStatus = EventTaskApprovalStatus.PendingReview;
            task.Status = EventTaskStatus.InProgress;
        }
        else
        {
            if (!pending) return AppResult<EventTaskDetailDto>.Conflict("This submission is no longer awaiting review.");
            if (action == "withdraw-completion")
            {
                if (task.AssignedMemberId != member) return AppResult<EventTaskDetailDto>.Forbidden("Only the assignee can withdraw completion.");
                task.ApprovalStatus = EventTaskApprovalStatus.NotSubmitted;
            }
            else
            {
                if (task.ReviewerMemberId != member || task.AssignedMemberId == member)
                    return AppResult<EventTaskDetailDto>.Forbidden("Only the named independent reviewer can decide.");
                if (!task.AssignedMemberId.HasValue || !await EligibleTaskMember(task.Event, task.AssignedMemberId.Value, ct))
                    return AppResult<EventTaskDetailDto>.Conflict("The assignee is no longer eligible; ask the owner to reassign the task.");
                if (action == "return" && string.IsNullOrWhiteSpace(request.Reason)) return AppResult<EventTaskDetailDto>.Validation("Explain the changes needed.");
                if (action == "approve" && (task.Dependencies.Any(x => x.DependsOnEventTask.Status != EventTaskStatus.Done) || task.Blockers.Any(x => x.ResolvedUtc == null)))
                    return AppResult<EventTaskDetailDto>.Conflict("Task prerequisites or blockers changed; return this submission.");
                task.ApprovalStatus = action == "approve" ? EventTaskApprovalStatus.Approved : EventTaskApprovalStatus.Returned;
                task.Status = action == "approve" ? EventTaskStatus.Done : EventTaskStatus.InProgress;
            }
        }
        var now = DateTime.UtcNow;
        AddTaskApprovalAction(task, member, action, request.Reason, now);
        task.CompletedUtc = task.Status == EventTaskStatus.Done ? now : null;
        task.ConcurrencyToken = Guid.NewGuid(); task.UpdatedUtc = now;
        db.EventIdempotencyRecords.Add(new() { Id = Guid.NewGuid(), Operation = operation, ScopeId = taskId,
            Key = key, RequestHash = hash, ResultEntityId = taskId, CreatedUtc = now, ExpiresUtc = now.AddDays(7) });
        if (packageInvalidation is not null && (task.IsRequired || task.RequiresApproval))
            await packageInvalidation.InvalidateForModuleChangeAsync(task.Event, member, "TEAM.WORK", operation, "operational", ct);
        try { await db.SaveChangesAsync(ct); if (tx is not null) await tx.CommitAsync(ct); }
        catch (DbUpdateConcurrencyException) { return AppResult<EventTaskDetailDto>.PreconditionFailed("The task changed concurrently; reload."); }
        catch (DbUpdateException) { return AppResult<EventTaskDetailDto>.Conflict("The task action conflicted with another request; reload."); }
        return await GetTaskAsync(eventId, taskId, member, ct);
    }

    private void AddTaskApprovalAction(EventTask task, Guid actor, string action, string reason, DateTime now)
        => db.EventTaskApprovalActions.Add(new() { Id = Guid.NewGuid(), EventTaskId = task.Id, Round = task.ApprovalRound,
            Action = action, ActorMemberId = actor, ReviewerMemberId = task.ReviewerMemberId,
            SnapshotJson = action == "submit-completion" ? EventPackageCanonicalizer.Serialize(new {
                task.TitleEn, task.TitleZh, task.DescriptionEn, task.DescriptionZh, task.AssignedMemberId, task.ReviewerMemberId,
                task.DueUtc, task.RequiresApproval, task.IsRequired, task.IsRestricted, task.ConcurrencyToken,
                prerequisites = task.Dependencies.Select(x => new { x.DependsOnEventTaskId, x.DependsOnEventTask.Status }) }) : "{}",
            Reason = reason.Trim(), CreatedUtc = now });

    private void InvalidateTaskApproval(EventTask task, Guid actor)
    {
        if (task.ApprovalStatus is EventTaskApprovalStatus.PendingReview or EventTaskApprovalStatus.Approved)
            AddTaskApprovalAction(task, actor, "invalidated", "Task definition or responsibility changed.", DateTime.UtcNow);
        if (task.ApprovalStatus == EventTaskApprovalStatus.Approved && task.Status == EventTaskStatus.Done) { task.Status = EventTaskStatus.InProgress; task.CompletedUtc = null; }
        task.ApprovalStatus = task.RequiresApproval ? EventTaskApprovalStatus.NotSubmitted : EventTaskApprovalStatus.NotRequired;
    }
}
