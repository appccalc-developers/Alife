using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Admin.Queries.ListAdminNotifications;

public sealed record ListAdminNotificationsQuery(
    Guid CurrentMemberId,
    string? Search,
    string? ActionType,
    string? Status,
    int Page = 1,
    int PageSize = 25)
    : IRequest<AppResult<AdminPagedResultDto<AdminNotificationDto>>>;
