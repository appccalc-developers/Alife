using Alife.Domain.Entities;

namespace Alife.Application.Events.Dtos;

public sealed record EventPreparationReopenDto(Guid Id, Guid EventPackageId, Guid RequestedByMemberId,
    LocalizedTextDto Reason, DateTime RequestedUtc, EventPreparationReopenStatus Status,
    Guid? ReviewedByMemberId, DateTime? ReviewedUtc, LocalizedTextDto? ReviewReason, string ETag, bool CanReview);
public sealed record EventPreparationStateDto(Guid EventId, bool IsFrozen, bool IsApproved, bool CanManage,
    bool CanEdit, Guid? ApprovedPackageId, EventPreparationReopenDto? ReopenRequest);
public sealed record RequestEventPreparationReopen(LocalizedTextDto Reason);
public sealed record ReviewEventPreparationReopen(bool Approve, LocalizedTextDto Reason);
