using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Admin.Queries.ListAuditLogs;

public sealed class ListAuditLogsQueryHandler(IAlifeDbContext dbContext)
    : IRequestHandler<ListAuditLogsQuery, AppResult<AdminPagedResultDto<AuditLogDto>>>
{
    public async Task<AppResult<AdminPagedResultDto<AuditLogDto>>> Handle(
        ListAuditLogsQuery request,
        CancellationToken cancellationToken)
    {
        if (!await AdminPlatformRoleHelpers.IsPlatformAdminAsync(dbContext, request.CurrentMemberId, cancellationToken))
        {
            return AppResult<AdminPagedResultDto<AuditLogDto>>.Forbidden("Platform admin access is required.");
        }

        var query = dbContext.AuditLogs
            .AsNoTracking()
            .AsQueryable();

        var search = request.Search?.Trim();
        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(x =>
                x.Action.Contains(search) ||
                x.EntityType.Contains(search) ||
                (x.ActorMember != null && x.ActorMember.DisplayName != null && x.ActorMember.DisplayName.Contains(search)) ||
                (x.TargetMember != null && x.TargetMember.DisplayName != null && x.TargetMember.DisplayName.Contains(search)));
        }

        var action = request.Action?.Trim();
        if (!string.IsNullOrWhiteSpace(action))
        {
            query = query.Where(x => x.Action.Contains(action));
        }

        var entityType = request.EntityType?.Trim();
        if (!string.IsNullOrWhiteSpace(entityType))
        {
            query = query.Where(x => x.EntityType == entityType);
        }

        if (request.FromUtc is DateTime fromUtc)
        {
            query = query.Where(x => x.OccurredUtc >= fromUtc);
        }

        if (request.ToUtc is DateTime toUtc)
        {
            query = query.Where(x => x.OccurredUtc <= toUtc);
        }

        var logsQuery = query
            .OrderByDescending(x => x.OccurredUtc)
            .Select(x => new AuditLogDto(
                x.Id,
                x.ActorMemberId,
                x.ActorMember == null ? null : x.ActorMember.DisplayName,
                x.Action,
                x.EntityType,
                x.EntityId,
                x.GroupId,
                x.EventId,
                x.TargetMemberId,
                x.TargetMember == null ? null : x.TargetMember.DisplayName,
                x.BeforeJson,
                x.AfterJson,
                x.MetadataJson,
                x.OccurredUtc));

        var logs = await AdminPaging.ToPagedResultAsync(logsQuery, request.Page, request.PageSize, cancellationToken);

        return AppResult<AdminPagedResultDto<AuditLogDto>>.Success(logs);
    }
}
