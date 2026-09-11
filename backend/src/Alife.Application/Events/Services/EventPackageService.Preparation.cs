using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Services;

public sealed partial class EventPackageService
{
    public async Task<AppResult<EventPreparationStateDto>> GetPreparationAsync(Guid eventId, Guid memberId, CancellationToken ct)
    {
        var access = await LoadViewableEvent(eventId, memberId, ct);
        if (!access.IsSuccess) return Failure<EventPreparationStateDto, GroupEvent>(access);
        var canManage = await EventCompositionPersistence.CanManageEventAsync(db, authorization, access.Value!, memberId, ct);
        var frozen = await EventPreparationPolicy.FrozenPackages(db, eventId).AsNoTracking().OrderByDescending(x => x.Version).FirstOrDefaultAsync(ct);
        var request = await db.EventPreparationReopenRequests.AsNoTracking().Where(x => x.EventId == eventId)
            .OrderByDescending(x => x.RequestedUtc).ThenByDescending(x => x.Id).FirstOrDefaultAsync(ct);
        EventPreparationReopenDto? dto = null;
        if (request is not null)
        {
            var package = await PackageQuery(asNoTracking: true).FirstAsync(x => x.Id == request.EventPackageId, ct);
            var authority = await ResolveDecisionAuthorityAsync(access.Value!, package, memberId, ct);
            var canReview = request.Status == EventPreparationReopenStatus.Pending && authority.Allowed &&
                (package.GovernanceTier == EventGovernanceTier.Light || request.RequestedByMemberId != memberId);
            dto = new(request.Id, request.EventPackageId, request.RequestedByMemberId,
                new(request.ReasonEn, request.ReasonZh), request.RequestedUtc, request.Status,
                request.ReviewedByMemberId, request.ReviewedUtc,
                request.ReviewedUtc.HasValue ? new(request.ReviewReasonEn ?? "", request.ReviewReasonZh ?? "") : null,
                ReopenETag(request), canReview);
        }
        return AppResult<EventPreparationStateDto>.Success(new(eventId, frozen is not null,
            await EventPreparationPolicy.IsApprovedAsync(db, eventId, ct), canManage,
            canManage && frozen is null, frozen?.Id, dto));
    }

    public async Task<AppResult<EventPreparationStateDto>> RequestPreparationReopenAsync(Guid eventId, Guid memberId,
        RequestEventPreparationReopen request, string? idempotencyKey, CancellationToken ct)
    {
        var access = await LoadViewableEvent(eventId, memberId, ct);
        if (!access.IsSuccess) return Failure<EventPreparationStateDto, GroupEvent>(access);
        if (!await EventCompositionPersistence.CanManageEventAsync(db, authorization, access.Value!, memberId, ct))
            return AppResult<EventPreparationStateDto>.Forbidden("Only Event managers may request reopening. / 只有活动负责人或小组管理者可申请撤销审批。");
        if (!ValidReopenReason(request.Reason) || ValidateIdempotencyKey(idempotencyKey) is { })
            return AppResult<EventPreparationStateDto>.Validation("A bilingual reason (1–2,000 characters each) and Idempotency-Key are required. / 请填写中英文理由，每种语言不超过 2,000 字符，并提供请求标识。");
        idempotencyKey = idempotencyKey!.Trim();
        const string operation = "event.preparation.reopen.request";
        var hash = EventPackageCanonicalizer.HashCanonical(new { eventId, memberId, request });
        await using var transaction = await db.BeginSerializableTransactionAsync(ct);
        var previous = await db.EventIdempotencyRecords.AsNoTracking().FirstOrDefaultAsync(x =>
            x.Operation == operation && x.ScopeId == eventId && x.Key == idempotencyKey, ct);
        if (previous is not null) return previous.RequestHash == hash ? await GetPreparationAsync(eventId, memberId, ct)
            : AppResult<EventPreparationStateDto>.Conflict("Idempotency-Key was used for a different request. / 此请求标识已用于其他申请。");
        var package = await EventPreparationPolicy.FrozenPackages(db, eventId).OrderByDescending(x => x.Version).FirstOrDefaultAsync(ct);
        if (package is null) return AppResult<EventPreparationStateDto>.Conflict("Preparation is already editable. / 活动当前已经可以修改。");
        if (await db.EventPreparationReopenRequests.AnyAsync(x => x.EventId == eventId && x.Status == EventPreparationReopenStatus.Pending, ct))
            return AppResult<EventPreparationStateDto>.Conflict("A reopening request is already awaiting review. / 已有撤销申请待处理，请勿重复申请。");
        var now = DateTime.UtcNow;
        var value = new EventPreparationReopenRequest { Id = Guid.NewGuid(), EventId = eventId, EventPackageId = package.Id,
            RequestedByMemberId = memberId, ReasonEn = request.Reason.En.Trim(), ReasonZh = request.Reason.Zh.Trim(), RequestedUtc = now };
        db.EventPreparationReopenRequests.Add(value);
        AddAudit(operation, access.Value!, memberId, package, now, new { frozen = true }, new { requestId = value.Id, status = value.Status });
        AddIdempotency(operation, eventId, idempotencyKey!, hash, value.Id, now);
        var approvers = await db.EventPackageDecisions.Where(x => x.EventPackageId == package.Id &&
            (x.DecisionType == EventPackageDecisionType.Approve || x.DecisionType == EventPackageDecisionType.ApproveWithConditions))
            .Select(x => x.ActorMemberId).Distinct().ToArrayAsync(ct);
        AddNotifications(approvers, memberId, access.Value!, package, operation, now, new { requestId = value.Id });
        try { await db.SaveChangesAsync(ct); if (transaction is not null) await transaction.CommitAsync(ct); }
        catch (DbUpdateException) { return AppResult<EventPreparationStateDto>.Conflict("The request changed concurrently. Refresh and retry. / 申请发生并发更新，请刷新后重试。"); }
        return await GetPreparationAsync(eventId, memberId, ct);
    }

    public async Task<AppResult<EventPreparationStateDto>> ReviewPreparationReopenAsync(Guid eventId, Guid requestId, Guid memberId,
        ReviewEventPreparationReopen request, string? ifMatch, string? idempotencyKey, CancellationToken ct)
    {
        var access = await LoadViewableEvent(eventId, memberId, ct);
        if (!access.IsSuccess) return Failure<EventPreparationStateDto, GroupEvent>(access);
        if (!ValidReopenReason(request.Reason) || ValidateIdempotencyKey(idempotencyKey) is { })
            return AppResult<EventPreparationStateDto>.Validation("A bilingual review reason and Idempotency-Key are required. / 请填写有效的中英文处理理由，并提供请求标识。");
        idempotencyKey = idempotencyKey!.Trim();
        const string operation = "event.preparation.reopen.review";
        var hash = EventPackageCanonicalizer.HashCanonical(new { eventId, requestId, memberId, request });
        await using var transaction = await db.BeginSerializableTransactionAsync(ct);
        var value = await db.EventPreparationReopenRequests.FirstOrDefaultAsync(x => x.Id == requestId && x.EventId == eventId, ct);
        if (value is null) return AppResult<EventPreparationStateDto>.NotFound("Reopening request not found. / 未找到撤销申请。");
        var package = await PackageQuery().FirstAsync(x => x.Id == value.EventPackageId && x.EventId == eventId, ct);
        var authority = await ResolveDecisionAuthorityAsync(access.Value!, package, memberId, ct);
        if (!authority.Allowed || (package.GovernanceTier != EventGovernanceTier.Light && value.RequestedByMemberId == memberId))
            return AppResult<EventPreparationStateDto>.Forbidden("An eligible independent approver must review this request. / 须由符合本方案审批权限及回避规则的审批人处理。");
        var previous = await db.EventIdempotencyRecords.AsNoTracking().FirstOrDefaultAsync(x =>
            x.Operation == operation && x.ScopeId == requestId && x.Key == idempotencyKey, ct);
        if (previous is not null) return previous.RequestHash == hash ? await GetPreparationAsync(eventId, memberId, ct)
            : AppResult<EventPreparationStateDto>.Conflict("Idempotency-Key was used for a different review. / 此请求标识已用于其他处理。");
        if (!Matches(ifMatch, ReopenETag(value))) return AppResult<EventPreparationStateDto>.PreconditionFailed("The reopening request changed. Refresh before reviewing. / 申请已更新，请刷新后再处理。");
        if (value.Status != EventPreparationReopenStatus.Pending) return AppResult<EventPreparationStateDto>.Conflict("The reopening request has already been reviewed. / 此申请已经处理。");
        var currentFrozen = await EventPreparationPolicy.FrozenPackages(db, eventId).OrderByDescending(x => x.Version).Select(x => (Guid?)x.Id).FirstOrDefaultAsync(ct);
        if (request.Approve && currentFrozen != value.EventPackageId)
            return AppResult<EventPreparationStateDto>.Conflict("This request refers to an earlier approval. Reject the outdated request and request reopening of the current approval. / 此申请对应旧审批，请拒绝旧申请，再针对当前审批重新申请。");
        var now = DateTime.UtcNow;
        value.Status = request.Approve ? EventPreparationReopenStatus.Approved : EventPreparationReopenStatus.Rejected;
        value.ReviewedByMemberId = memberId; value.ReviewedUtc = now;
        value.ReviewReasonEn = request.Reason.En.Trim(); value.ReviewReasonZh = request.Reason.Zh.Trim(); value.ConcurrencyToken = Guid.NewGuid();
        if (request.Approve)
        {
            // Revoke Event approval; dependent occurrence evidence is invalidated, without
            // impersonating the authority of its possibly higher-tier approvers.
            var approvedPackages = await PackageQuery().Where(x => x.EventId == eventId &&
                (x.Status == EventPackageStatus.Approved || x.Status == EventPackageStatus.ApprovedWithConditions) &&
                x.ApprovalValidityStatus != EventPackageApprovalValidity.Revoked).ToListAsync(ct);
            foreach (var approved in approvedPackages)
            {
                if (approved.ScopeType != EventPackageScopeType.Event)
                {
                    approved.ApprovalValidityStatus = EventPackageApprovalValidity.Invalidated;
                    approved.ConcurrencyToken = Guid.NewGuid();
                    AddAudit("event.package.baselineReopened", access.Value!, memberId, approved, now,
                        new { validity = EventPackageApprovalValidity.Active }, new { validity = approved.ApprovalValidityStatus, requestId });
                    continue;
                }
                var approvedAuthority = await ResolveDecisionAuthorityAsync(access.Value!, approved, memberId, ct);
                if (!approvedAuthority.Allowed) return AppResult<EventPreparationStateDto>.Forbidden("The reviewer must be eligible for every frozen Event approval. / 处理人须具备所有冻结方案的审批权限。");
                foreach (var decision in approved.Decisions.Where(x =>
                    (x.DecisionType == EventPackageDecisionType.Approve || x.DecisionType == EventPackageDecisionType.ApproveWithConditions) &&
                    !approved.Decisions.Any(r => r.DecisionType == EventPackageDecisionType.Revoke && r.RevokedByDecisionId == x.Id)).ToArray())
                    db.EventPackageDecisions.Add(new() { Id = Guid.NewGuid(), EventPackageId = approved.Id,
                        DecisionType = EventPackageDecisionType.Revoke, RevokedByDecisionId = decision.Id, ActorMemberId = memberId,
                        ReasonEn = value.ReviewReasonEn, ReasonZh = value.ReviewReasonZh, DecidedUtc = now, EffectiveUtc = now,
                        RequestHash = hash, DecisionAuthoritySnapshotJson = EventPackageCanonicalizer.Serialize(new {
                            authority.AuthorityCode, authority.AuthorityGroupId, reopenRequestId = value.Id, reviewedPackageId = package.Id }) });
                approved.ApprovalValidityStatus = EventPackageApprovalValidity.Revoked; approved.ConcurrencyToken = Guid.NewGuid();
                AddAudit("event.package.preparationReopened", access.Value!, memberId, approved, now,
                    new { frozen = true }, new { frozen = false, requestId });
            }
            var item = await db.GroupEvents.FirstAsync(x => x.Id == eventId, ct);
            item.PublicationStatus = EventPublicationStatus.Draft; item.PublicationConcurrencyToken = Guid.NewGuid();
            item.RegistrationStatus = EventRegistrationStatus.Closed; item.RegistrationConcurrencyToken = Guid.NewGuid();
            item.ExecutionStatus = EventExecutionStatus.Invalidated; item.ExecutionConcurrencyToken = Guid.NewGuid(); item.UpdatedUtc = now;
            foreach (var occurrence in await db.EventOccurrences.Where(x => x.EventId == eventId && x.ExecutionStatus == EventExecutionStatus.Confirmed).ToListAsync(ct))
            {
                occurrence.ExecutionStatus = EventExecutionStatus.Invalidated;
                occurrence.ExecutionConcurrencyToken = Guid.NewGuid(); occurrence.UpdatedUtc = now;
            }
        }
        AddAudit(operation, access.Value!, memberId, package, now, new { status = EventPreparationReopenStatus.Pending }, new { requestId, value.Status });
        AddIdempotency(operation, requestId, idempotencyKey!, hash, requestId, now);
        AddNotifications([value.RequestedByMemberId], memberId, access.Value!, package, operation, now, new { requestId, value.Status });
        try { await db.SaveChangesAsync(ct); if (transaction is not null) await transaction.CommitAsync(ct); }
        catch (DbUpdateConcurrencyException) { return AppResult<EventPreparationStateDto>.PreconditionFailed("The request or approval changed. Refresh before retrying. / 申请或审批状态已更新，请刷新后重试。"); }
        catch (DbUpdateException) { return AppResult<EventPreparationStateDto>.Conflict("Reopening conflicted. Refresh and retry. / 撤销处理发生冲突，请刷新后重试。"); }
        if (request.Approve && cacheInvalidation is not null) await cacheInvalidation.RemoveGroupEventsAsync(access.Value!.GroupId, ct);
        return await GetPreparationAsync(eventId, memberId, ct);
    }

    private static bool ValidReopenReason(LocalizedTextDto? value) => value is not null &&
        !string.IsNullOrWhiteSpace(value.En) && value.En.Length <= 2000 && !string.IsNullOrWhiteSpace(value.Zh) && value.Zh.Length <= 2000;
    private static string ReopenETag(EventPreparationReopenRequest value) => $"\"event-reopen-{value.ConcurrencyToken:N}\"";
}
