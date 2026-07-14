using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Groups.Services;
using Alife.Application.Notifications.Dtos;
using Alife.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Notifications.Commands.CreateNotification;

public sealed class CreateNotificationCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService)
    : IRequestHandler<CreateNotificationCommand, AppResult<NotificationMessageDto>>
{
    public async Task<AppResult<NotificationMessageDto>> Handle(
        CreateNotificationCommand request,
        CancellationToken cancellationToken)
    {
        var actionType = request.ActionType.Trim();
        if (string.IsNullOrWhiteSpace(actionType))
        {
            return AppResult<NotificationMessageDto>.Validation("Action type is required.");
        }

        if (actionType.Length > 100)
        {
            return AppResult<NotificationMessageDto>.Validation("Action type must be 100 characters or fewer.");
        }

        var recipientExists = await dbContext.Members
            .AsNoTracking()
            .AnyAsync(x => x.Id == request.RecipientMemberId && x.IsRegistered, cancellationToken);

        if (!recipientExists)
        {
            return AppResult<NotificationMessageDto>.NotFound("Recipient member not found.");
        }

        var groupId = request.GroupId;
        if (request.EventId.HasValue)
        {
            var groupEvent = await dbContext.GroupEvents
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == request.EventId.Value, cancellationToken);

            if (groupEvent is null)
            {
                return AppResult<NotificationMessageDto>.NotFound("Event not found.");
            }

            if (groupId.HasValue && groupId.Value != groupEvent.GroupId)
            {
                return AppResult<NotificationMessageDto>.Validation("Event does not belong to the requested group.");
            }

            groupId = groupEvent.GroupId;
        }

        if (groupId.HasValue)
        {
            var canCreateForGroup = await groupAuthorizationService.IsLeaderOrCoLeaderAsync(
                groupId.Value,
                request.CurrentMemberId,
                cancellationToken);

            if (!canCreateForGroup)
            {
                return AppResult<NotificationMessageDto>.Forbidden("You must be a group leader or co-leader to create group notifications.");
            }

            var recipientIsGroupMember = await groupAuthorizationService.IsApprovedMemberAsync(
                groupId.Value,
                request.RecipientMemberId,
                cancellationToken);

            if (!recipientIsGroupMember)
            {
                return AppResult<NotificationMessageDto>.Forbidden("Recipient must be an approved member of the group.");
            }
        }
        else if (request.RecipientMemberId != request.CurrentMemberId)
        {
            return AppResult<NotificationMessageDto>.Forbidden("You can only create personal notifications for yourself.");
        }

        var now = DateTime.UtcNow;
        var notification = new NotificationMessage
        {
            Id = Guid.NewGuid(),
            RecipientMemberId = request.RecipientMemberId,
            CreatedByMemberId = request.CurrentMemberId,
            GroupId = groupId,
            EventId = request.EventId,
            OccurredUtc = request.OccurredUtc ?? now,
            ActionType = actionType,
            ActionDataJson = request.ActionDataJson,
            CreatedUtc = now,
            UpdatedUtc = now
        };

        dbContext.NotificationMessages.Add(notification);
        await dbContext.SaveChangesAsync(cancellationToken);

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
            notification.UpdatedUtc,
            notification.AnnouncementId);
}
