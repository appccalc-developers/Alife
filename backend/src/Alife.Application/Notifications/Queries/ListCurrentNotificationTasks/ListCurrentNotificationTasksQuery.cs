using Alife.Application.Common.Models;
using Alife.Application.Notifications.Dtos;
using MediatR;

namespace Alife.Application.Notifications.Queries.ListCurrentNotificationTasks;

public sealed record ListCurrentNotificationTasksQuery(Guid CurrentMemberId)
    : IRequest<AppResult<IReadOnlyList<CurrentNotificationTaskDto>>>;
