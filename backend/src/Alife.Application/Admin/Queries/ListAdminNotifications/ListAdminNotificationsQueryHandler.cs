using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Admin.Queries.ListAdminNotifications;

public sealed class ListAdminNotificationsQueryHandler(IAlifeDbContext dbContext)
    : IRequestHandler<ListAdminNotificationsQuery, AppResult<AdminPagedResultDto<AdminNotificationDto>>>
{
    public async Task<AppResult<AdminPagedResultDto<AdminNotificationDto>>> Handle(
        ListAdminNotificationsQuery request,
        CancellationToken cancellationToken)
    {
        if (!await AdminPlatformRoleHelpers.HasPermissionAsync(
                dbContext,
                request.CurrentMemberId,
                AdminPermissionCatalog.ManageMessages,
                cancellationToken))
        {
            return AppResult<AdminPagedResultDto<AdminNotificationDto>>.Forbidden("You do not have permission to manage admin messages.");
        }

        var query = dbContext.NotificationMessages
            .AsNoTracking()
            .AsQueryable();

        var search = request.Search?.Trim();
        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(x =>
                x.ActionType.Contains(search) ||
                (x.RecipientMember.DisplayName != null && x.RecipientMember.DisplayName.Contains(search)) ||
                (x.CreatedByMember.DisplayName != null && x.CreatedByMember.DisplayName.Contains(search)) ||
                (x.Group != null && x.Group.NameJson.Contains(search)) ||
                (x.Event != null && (x.Event.TitleEn.Contains(search) || x.Event.TitleZh.Contains(search))));
        }

        var actionType = request.ActionType?.Trim();
        if (!string.IsNullOrWhiteSpace(actionType))
        {
            query = query.Where(x => x.ActionType.Contains(actionType));
        }

        var status = request.Status?.Trim().ToLowerInvariant();
        query = status switch
        {
            "unread" => query.Where(x => x.ReadUtc == null),
            "read" => query.Where(x => x.ReadUtc != null && x.RepliedUtc == null),
            "replied" => query.Where(x => x.RepliedUtc != null),
            _ => query
        };

        var notificationsQuery = query
            .OrderByDescending(x => x.OccurredUtc)
            .Select(x => new AdminNotificationDto(
                x.Id,
                x.RecipientMemberId,
                x.RecipientMember.DisplayName,
                x.CreatedByMemberId,
                x.CreatedByMember.DisplayName,
                x.GroupId,
                x.Group == null ? null : x.Group.NameJson,
                x.EventId,
                x.Event == null ? null : x.Event.TitleEn,
                x.Event == null ? null : x.Event.TitleZh,
                x.OccurredUtc,
                x.ActionType,
                x.ActionDataJson,
                x.ResponseDataJson,
                x.ReadUtc,
                x.RepliedUtc,
                x.CreatedUtc,
                x.UpdatedUtc));

        var notifications = await AdminPaging.ToPagedResultAsync(
            notificationsQuery,
            request.Page,
            request.PageSize,
            cancellationToken);

        return AppResult<AdminPagedResultDto<AdminNotificationDto>>.Success(notifications);
    }
}
