using Alife.Application.Announcements.Dtos;
using Alife.Application.Common.Models;
using Alife.Domain.Enums;
using MediatR;

namespace Alife.Application.Announcements.Commands.SaveAnnouncement;

public sealed record SaveAnnouncementCommand(
    Guid? AnnouncementId,
    Guid GroupId,
    Guid CurrentMemberId,
    IReadOnlyDictionary<string, string> Title,
    IReadOnlyDictionary<string, string> Summary,
    IReadOnlyDictionary<string, string>? Content,
    AnnouncementAudience Audience,
    AnnouncementPriority Priority,
    AnnouncementStatus Status,
    DateTime PublishUtc,
    DateTime? ExpireUtc,
    bool IsPinned,
    bool CreateNotifications)
    : IRequest<AppResult<AnnouncementDto>>;
