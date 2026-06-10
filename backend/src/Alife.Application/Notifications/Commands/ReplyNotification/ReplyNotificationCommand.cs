using Alife.Application.Common.Models;
using Alife.Application.Notifications.Dtos;
using MediatR;

namespace Alife.Application.Notifications.Commands.ReplyNotification;

public sealed record ReplyNotificationCommand(
    Guid NotificationId,
    Guid CurrentMemberId,
    string ResponseDataJson)
    : IRequest<AppResult<NotificationMessageDto>>;
