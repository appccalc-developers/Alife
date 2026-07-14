namespace Alife.Application.Notifications.Dtos;

public sealed record NotificationMessageDto(
    Guid Id,
    Guid RecipientMemberId,
    Guid CreatedByMemberId,
    Guid? GroupId,
    Guid? EventId,
    DateTime OccurredUtc,
    string ActionType,
    string ActionDataJson,
    string? ResponseDataJson,
    DateTime? ReadUtc,
    DateTime? RepliedUtc,
    DateTime CreatedUtc,
    DateTime UpdatedUtc,
    Guid? AnnouncementId = null);
