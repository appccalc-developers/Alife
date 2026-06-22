namespace Alife.Application.Admin.Dtos;

public sealed record AdminNotificationDto(
    Guid Id,
    Guid RecipientMemberId,
    string? RecipientDisplayName,
    Guid CreatedByMemberId,
    string? CreatedByDisplayName,
    Guid? GroupId,
    string? GroupNameJson,
    Guid? EventId,
    string? EventTitleEn,
    string? EventTitleZh,
    DateTime OccurredUtc,
    string ActionType,
    string ActionDataJson,
    string? ResponseDataJson,
    DateTime? ReadUtc,
    DateTime? RepliedUtc,
    DateTime CreatedUtc,
    DateTime UpdatedUtc);
