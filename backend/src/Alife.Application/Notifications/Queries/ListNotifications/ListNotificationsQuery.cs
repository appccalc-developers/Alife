using Alife.Application.Common.Models;
using Alife.Application.Notifications.Dtos;
using MediatR;

namespace Alife.Application.Notifications.Queries.ListNotifications;

public sealed record ListNotificationsQuery(Guid CurrentMemberId)
    : IRequest<AppResult<IReadOnlyList<NotificationMessageDto>>>;
