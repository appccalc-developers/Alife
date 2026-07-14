using System.Text.Json;
using Alife.Application.Announcements.Dtos;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Announcements.Commands.SaveAnnouncement;

public sealed class SaveAnnouncementCommandHandler(IAlifeDbContext db, IGroupAuthorizationService authorization)
    : IRequestHandler<SaveAnnouncementCommand, AppResult<AnnouncementDto>>
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<AppResult<AnnouncementDto>> Handle(SaveAnnouncementCommand request, CancellationToken cancellationToken)
    {
        var group = await db.Groups.AsNoTracking().FirstOrDefaultAsync(x => x.Id == request.GroupId, cancellationToken);
        if (group is null) return AppResult<AnnouncementDto>.NotFound("Group not found.");
        if (!await authorization.IsLeaderOrCoLeaderAsync(group.Id, request.CurrentMemberId, cancellationToken))
            return AppResult<AnnouncementDto>.Forbidden("Only group leaders and co-leaders can manage announcements.");

        var title = AnnouncementMapper.Normalize(request.Title);
        var summary = AnnouncementMapper.Normalize(request.Summary);
        var content = AnnouncementMapper.Normalize(request.Content);
        if (!AnnouncementAuthorization.HasLocalizedValue(title)) return AppResult<AnnouncementDto>.Validation("An English or Chinese title is required.");
        if (!AnnouncementAuthorization.HasLocalizedValue(summary)) return AppResult<AnnouncementDto>.Validation("An English or Chinese summary is required.");
        var validation = AnnouncementAuthorization.ValidateSchedule(request.PublishUtc, request.ExpireUtc)
            ?? AnnouncementAuthorization.ValidateAudience(group, request.Audience);
        if (validation is not null) return AppResult<AnnouncementDto>.Validation(validation);

        Announcement announcement;
        var wasPublished = false;
        if (request.AnnouncementId.HasValue)
        {
            announcement = await db.Announcements.FirstOrDefaultAsync(x => x.Id == request.AnnouncementId.Value, cancellationToken)
                ?? null!;
            if (announcement is null) return AppResult<AnnouncementDto>.NotFound("Announcement not found.");
            if (announcement.GroupId != group.Id) return AppResult<AnnouncementDto>.Forbidden("Announcement belongs to another group.");
            wasPublished = announcement.Status == AnnouncementStatus.Published;
        }
        else
        {
            var now = DateTime.UtcNow;
            announcement = new Announcement
            {
                Id = Guid.NewGuid(),
                GroupId = group.Id,
                CreatedByMemberId = request.CurrentMemberId,
                CreatedUtc = now,
                UpdatedUtc = now
            };
            db.Announcements.Add(announcement);
        }

        announcement.TitleJson = AnnouncementMapper.WriteLocalized(title);
        announcement.SummaryJson = AnnouncementMapper.WriteLocalized(summary);
        announcement.ContentJson = content.Count == 0 ? null : AnnouncementMapper.WriteLocalized(content);
        announcement.Audience = request.Audience;
        announcement.Priority = request.Priority;
        announcement.Status = request.Status;
        announcement.PublishUtc = request.PublishUtc.ToUniversalTime();
        announcement.ExpireUtc = request.ExpireUtc?.ToUniversalTime();
        announcement.IsPinned = request.IsPinned;
        announcement.UpdatedUtc = DateTime.UtcNow;

        if (request.CreateNotifications && request.Status == AnnouncementStatus.Published && !wasPublished)
        {
            await AddPublicationNotificationsAsync(announcement, request.CurrentMemberId, cancellationToken);
        }

        await db.SaveChangesAsync(cancellationToken);
        return AppResult<AnnouncementDto>.Success(AnnouncementMapper.ToDto(announcement));
    }

    private async Task AddPublicationNotificationsAsync(
        Announcement announcement,
        Guid currentMemberId,
        CancellationToken cancellationToken)
    {
        IQueryable<Guid> recipientQuery;
        if (announcement.Audience == AnnouncementAudience.Public)
        {
            recipientQuery = db.Members.AsNoTracking().Where(x => x.IsRegistered).Select(x => x.Id);
        }
        else if (announcement.Audience == AnnouncementAudience.SpecificGroup)
        {
            recipientQuery = db.GroupMemberships.AsNoTracking()
                .Where(x => x.GroupId == announcement.GroupId && x.Status == MembershipStatus.Approved)
                .Select(x => x.MemberId);
        }
        else
        {
            var group = await db.Groups.AsNoTracking().FirstAsync(x => x.Id == announcement.GroupId, cancellationToken);
            var church = await AnnouncementAuthorization.FindChurchAsync(db, group, cancellationToken);
            var groupIds = church is null ? new HashSet<Guid> { group.Id } : await AnnouncementAuthorization.GetChurchGroupIdsAsync(db, church.Id, cancellationToken);
            recipientQuery = db.GroupMemberships.AsNoTracking()
                .Where(x => groupIds.Contains(x.GroupId) && x.Status == MembershipStatus.Approved)
                .Select(x => x.MemberId);
        }

        var recipientIds = await recipientQuery.Distinct().ToListAsync(cancellationToken);
        var now = DateTime.UtcNow;
        var actionData = JsonSerializer.Serialize(new
        {
            announcementId = announcement.Id,
            groupId = announcement.GroupId,
            title = new { en = "New announcement", zh = "新公告" },
            actionUrl = $"/groups/{announcement.GroupId}"
        }, JsonOptions);
        db.NotificationMessages.AddRange(recipientIds.Select(memberId => new NotificationMessage
        {
            Id = Guid.NewGuid(),
            RecipientMemberId = memberId,
            CreatedByMemberId = currentMemberId,
            GroupId = announcement.GroupId,
            AnnouncementId = announcement.Id,
            OccurredUtc = now,
            ActionType = "announcement.published",
            ActionDataJson = actionData,
            CreatedUtc = now,
            UpdatedUtc = now
        }));
    }
}
