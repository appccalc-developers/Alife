using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Notifications.Dtos;
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
                x.UpdatedUtc))
            .ToListAsync(cancellationToken);

        return AppResult<IReadOnlyList<NotificationMessageDto>>.Success(notifications);
    }
}
