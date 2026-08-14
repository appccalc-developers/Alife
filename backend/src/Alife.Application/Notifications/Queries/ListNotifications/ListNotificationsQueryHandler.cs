using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Notifications.Dtos;
using Alife.Application.Notifications.Services;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Notifications.Queries.ListNotifications;

public sealed class ListNotificationsQueryHandler(IAlifeDbContext dbContext)
    : IRequestHandler<ListNotificationsQuery, AppResult<IReadOnlyList<NotificationMessageDto>>>
{
    public async Task<AppResult<IReadOnlyList<NotificationMessageDto>>> Handle(
        ListNotificationsQuery request,
        CancellationToken cancellationToken)
    {
        var notifications = await dbContext.NotificationMessages
            .AsNoTracking()
            .Where(x => x.RecipientMemberId == request.CurrentMemberId)
            .OrderBy(x => x.ReadUtc.HasValue)
            .ThenBy(x => x.RepliedUtc.HasValue)
            .ThenByDescending(x => x.OccurredUtc)
            .Select(x => new NotificationMessageDto(
                x.Id,
                x.RecipientMemberId,
                x.CreatedByMemberId,
                x.GroupId,
                x.EventId,
                x.OccurredUtc,
                x.ActionType,
                x.ActionDataJson,
                x.ResponseDataJson,
                x.ReadUtc,
                x.RepliedUtc,
                x.CreatedUtc,
                x.UpdatedUtc,
                x.AnnouncementId))
            .ToListAsync(cancellationToken);

        var reviewGroupIds = notifications
            .Where(x => MembershipNotificationActionData.RequiresMembershipReview(x.ActionType))
            .Select(x => MembershipNotificationActionData.ResolveGroupId(x.GroupId, x.ActionDataJson))
            .Where(x => x.HasValue)
            .Select(x => x!.Value)
            .Distinct()
            .ToArray();

        if (reviewGroupIds.Length > 0)
        {
            var groupScopes = await dbContext.Groups
                .AsNoTracking()
                .Where(x => reviewGroupIds.Contains(x.Id))
                .Select(x => new { x.Id, x.IsChurch })
                .ToDictionaryAsync(x => x.Id, x => x.IsChurch, cancellationToken);

            notifications = notifications
                .Select(notification =>
                {
                    var groupId = MembershipNotificationActionData.ResolveGroupId(
                        notification.GroupId,
                        notification.ActionDataJson);
                    if (!groupId.HasValue || !groupScopes.TryGetValue(groupId.Value, out var isChurch))
                    {
                        return notification;
                    }

                    return notification with
                    {
                        ActionDataJson = MembershipNotificationActionData.NormalizeReviewUrl(
                            notification.ActionType,
                            notification.ActionDataJson,
                            groupId.Value,
                            isChurch)
                    };
                })
                .ToList();
        }

        return AppResult<IReadOnlyList<NotificationMessageDto>>.Success(notifications);
    }
}
