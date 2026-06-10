using Alife.Application.Common.Models;
using Alife.Application.Notifications.Dtos;
using MediatR;

namespace Alife.Application.Notifications.Commands.CreateNotification;

public sealed record CreateNotificationCommand(
    Guid CurrentMemberId,
    Guid RecipientMemberId,
    Guid? GroupId,
    Guid? EventId,
    DateTime? OccurredUtc,
    string ActionType,
    string ActionDataJson)
    : IRequest<AppResult<NotificationMessageDto>>;
