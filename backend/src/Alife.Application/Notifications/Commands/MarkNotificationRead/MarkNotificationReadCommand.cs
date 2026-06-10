using Alife.Application.Common.Models;
using Alife.Application.Notifications.Dtos;
using MediatR;

namespace Alife.Application.Notifications.Commands.MarkNotificationRead;

public sealed record MarkNotificationReadCommand(Guid NotificationId, Guid CurrentMemberId)
    : IRequest<AppResult<NotificationMessageDto>>;
