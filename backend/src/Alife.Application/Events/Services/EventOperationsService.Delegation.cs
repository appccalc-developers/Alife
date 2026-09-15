using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Services;

public sealed partial class EventOperationsService
{
    private async Task<AppResult<EventTaskDetailDto>> ActOnDelegatedTaskAsync(Guid eventId, Guid taskId, Guid member,
        string action, EventTaskApprovalRequest request, string? ifMatch, string? key, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(key) || key.Length is < 8 or > 120)
            return AppResult<EventTaskDetailDto>.Validation("An 8–120 character Idempotency-Key is required.");
        await using var tx = await db.BeginSerializableTransactionAsync(ct);
        var task = await TaskQuery(eventId).FirstOrDefaultAsync(x => x.Id == taskId, ct);
        if (task is null) return AppResult<EventTaskDetailDto>.NotFound("Task not found.");
        if (!await EligibleTaskMember(task.Event, member, ct) ||
            (action == "select-publication" ? !await CanManage(task.Event, member, ct) : task.AssignedMemberId != member))
            return AppResult<EventTaskDetailDto>.Forbidden("Only the current assignee can respond or prepare; the owner selects publication material.");
        if (await IsSystemTask(task, ct)) return AppResult<EventTaskDetailDto>.Conflict("Use the authoritative specialist workflow.");
        var operation = $"event.task.{action}";
        var hash = EventPackageCanonicalizer.HashCanonical(new { eventId, taskId, member, action, request, ifMatch });
        var replay = await db.EventIdempotencyRecords.AsNoTracking().FirstOrDefaultAsync(x => x.Operation == operation && x.ScopeId == taskId && x.Key == key, ct);
        if (replay is not null) return replay.RequestHash == hash ? await GetTaskAsync(eventId, taskId, member, ct)
            : AppResult<EventTaskDetailDto>.Conflict("Idempotency key was used for a different request.");
        if (!Matches(ifMatch, TaskETag(task))) return AppResult<EventTaskDetailDto>.PreconditionFailed("The task changed; reload the current version.");
        if (task.Status == EventTaskStatus.Cancelled || task.Status == EventTaskStatus.Done && action != "select-publication")
            return AppResult<EventTaskDetailDto>.Conflict("This task is no longer active.");
        var now = DateTime.UtcNow;
        if (action is "accept-assignment" or "decline-assignment")
        {
            if (task.AssignmentStatus != "invited") return AppResult<EventTaskDetailDto>.Conflict("This delegation has already been answered.");
            task.AssignmentStatus = action == "accept-assignment" ? "accepted" : "declined";
            task.AssignmentRespondedUtc = now;
        }
        else if (action == "save-preparation")
        {
            if (task.AssignmentStatus != "accepted" || task.ApprovalStatus == EventTaskApprovalStatus.PendingReview)
                return AppResult<EventTaskDetailDto>.Conflict("Accept the delegation and withdraw any pending completion review before changing preparation.");
            if (request.Preparation is not { En: not null, Zh: not null } content || content.En.Length > 4000 || content.Zh.Length > 4000 ||
                string.IsNullOrWhiteSpace(content.En) && string.IsNullOrWhiteSpace(content.Zh))
                return AppResult<EventTaskDetailDto>.Validation("Enter preparation notes (up to 4,000 characters per language). / 请填写准备情况（每种语言最多 4,000 字）。");
            task.PreparationEn = content.En.Trim(); task.PreparationZh = content.Zh.Trim(); task.PreparationUpdatedUtc = now;
            task.PreparationPublicationCandidate = false;
            if (task.Status == EventTaskStatus.Todo) task.Status = EventTaskStatus.InProgress;
        }
        else
        {
            if (request.PublicationCandidate is null) return AppResult<EventTaskDetailDto>.Validation("Choose whether to select this preparation as publication material.");
            if (request.PublicationCandidate == true && (task.IsRestricted || task.AssignmentStatus != "accepted" ||
                string.IsNullOrWhiteSpace(task.PreparationEn) || string.IsNullOrWhiteSpace(task.PreparationZh)))
                return AppResult<EventTaskDetailDto>.Validation("Only unrestricted preparation with both languages can be selected. / 仅可选择已填写中英双语的非受限准备情况。");
            task.PreparationPublicationCandidate = request.PublicationCandidate.Value;
            // Publication curation must not invalidate the approved preparation source vector.
            task.PublicationSelectionToken = Guid.NewGuid();
        }
        if (action != "select-publication") task.ConcurrencyToken = Guid.NewGuid();
        task.UpdatedUtc = now;
        db.EventIdempotencyRecords.Add(new() { Id = Guid.NewGuid(), Operation = operation, ScopeId = taskId,
            Key = key, RequestHash = hash, ResultEntityId = taskId, CreatedUtc = now, ExpiresUtc = now.AddDays(7) });
        if (task.Stage == "preparation" && action != "select-publication" && packageInvalidation is not null && (task.IsRequired || task.RequiresApproval))
            await packageInvalidation.InvalidateForModuleChangeAsync(task.Event, member, "TEAM.WORK", operation, "operational", ct);
        try { await db.SaveChangesAsync(ct); if (tx is not null) await tx.CommitAsync(ct); }
        catch (DbUpdateConcurrencyException) { return AppResult<EventTaskDetailDto>.PreconditionFailed("The task changed concurrently; reload."); }
        catch (DbUpdateException) { return AppResult<EventTaskDetailDto>.Conflict("The task action conflicted with another request; reload."); }
        return await GetTaskAsync(eventId, taskId, member, ct);
    }
}
