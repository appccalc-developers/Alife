using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Announcements.Commands.DeleteAnnouncement;

public sealed record DeleteAnnouncementCommand(Guid AnnouncementId, Guid CurrentMemberId) : IRequest<AppResult<bool>>;
