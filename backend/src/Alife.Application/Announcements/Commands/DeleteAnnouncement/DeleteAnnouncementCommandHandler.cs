using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Groups.Services;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Announcements.Commands.DeleteAnnouncement;

public sealed class DeleteAnnouncementCommandHandler(IAlifeDbContext db, IGroupAuthorizationService authorization)
    : IRequestHandler<DeleteAnnouncementCommand, AppResult<bool>>
{
    public async Task<AppResult<bool>> Handle(DeleteAnnouncementCommand request, CancellationToken cancellationToken)
    {
        var announcement = await db.Announcements.FirstOrDefaultAsync(x => x.Id == request.AnnouncementId, cancellationToken);
        if (announcement is null) return AppResult<bool>.NotFound("Announcement not found.");
        if (!await authorization.IsLeaderOrCoLeaderAsync(announcement.GroupId, request.CurrentMemberId, cancellationToken))
            return AppResult<bool>.Forbidden("Only group leaders and co-leaders can delete announcements.");

        var hasNotifications = await db.NotificationMessages.AsNoTracking().AnyAsync(x => x.AnnouncementId == announcement.Id, cancellationToken);
        if (hasNotifications || announcement.Status == AnnouncementStatus.Published)
        {
            announcement.Status = AnnouncementStatus.Archived;
            announcement.UpdatedUtc = DateTime.UtcNow;
        }
        else
        {
            db.Announcements.Remove(announcement);
        }

        await db.SaveChangesAsync(cancellationToken);
        return AppResult<bool>.Success(true);
    }
}
