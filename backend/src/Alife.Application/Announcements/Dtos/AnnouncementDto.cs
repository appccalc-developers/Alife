using Alife.Domain.Enums;

namespace Alife.Application.Announcements.Dtos;

public sealed record AnnouncementDto(
    Guid Id,
    Guid GroupId,
    IReadOnlyDictionary<string, string> Title,
    IReadOnlyDictionary<string, string> Summary,
    IReadOnlyDictionary<string, string>? Content,
    AnnouncementAudience Audience,
    AnnouncementPriority Priority,
    AnnouncementStatus Status,
    DateTime PublishUtc,
    DateTime? ExpireUtc,
    bool IsPinned,
    Guid CreatedByMemberId,
    DateTime CreatedUtc,
    DateTime UpdatedUtc);
