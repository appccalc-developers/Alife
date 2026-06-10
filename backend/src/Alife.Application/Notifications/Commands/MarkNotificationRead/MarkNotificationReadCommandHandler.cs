using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Notifications.Dtos;
using Alife.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Notifications.Commands.MarkNotificationRead;

public sealed class MarkNotificationReadCommandHandler(IAlifeDbContext dbContext)
    : IRequestHandler<MarkNotificationReadCommand, AppResult<NotificationMessageDto>>
{
    public async Task<AppResult<NotificationMessageDto>> Handle(
        MarkNotificationReadCommand request,
        CancellationToken cancellationToken)
    {
        var notification = await dbContext.NotificationMessages
            .FirstOrDefaultAsync(x => x.Id == request.NotificationId, cancellationToken);

        if (notification is null)
        {
            return AppResult<NotificationMessageDto>.NotFound("Notification not found.");
        }

        if (notification.RecipientMemberId != request.CurrentMemberId)
        {
            return AppResult<NotificationMessageDto>.Forbidden("You can only mark your own notifications as read.");
        }

        if (!notification.ReadUtc.HasValue)
        {
            var now = DateTime.UtcNow;
            notification.ReadUtc = now;
            notification.UpdatedUtc = now;
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        return AppResult<NotificationMessageDto>.Success(ToDto(notification));
    }

    private static NotificationMessageDto ToDto(NotificationMessage notification) =>
        new(
            notification.Id,
            notification.RecipientMemberId,
            notification.CreatedByMemberId,
            notification.GroupId,
            notification.EventId,
            notification.OccurredUtc,
            notification.ActionType,
            notification.ActionDataJson,
            notification.ResponseDataJson,
            notification.ReadUtc,
            notification.RepliedUtc,
            notification.CreatedUtc,
            notification.UpdatedUtc);
}
