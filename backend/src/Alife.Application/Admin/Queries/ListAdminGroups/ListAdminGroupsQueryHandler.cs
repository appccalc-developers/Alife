using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Admin.Queries.ListAdminGroups;

public sealed class ListAdminGroupsQueryHandler(IAlifeDbContext dbContext)
    : IRequestHandler<ListAdminGroupsQuery, AppResult<AdminPagedResultDto<AdminGroupOptionDto>>>
{
    public async Task<AppResult<AdminPagedResultDto<AdminGroupOptionDto>>> Handle(
        ListAdminGroupsQuery request,
        CancellationToken cancellationToken)
    {
        if (!await AdminPlatformRoleHelpers.IsPlatformAdminAsync(dbContext, request.CurrentMemberId, cancellationToken))
        {
            return AppResult<AdminPagedResultDto<AdminGroupOptionDto>>.Forbidden("Platform admin access is required.");
        }

        var query = dbContext.Groups.AsNoTracking().AsQueryable();
        var search = request.Search?.Trim();
        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(x => x.NameJson.Contains(search));
        }

        var groupsQuery = query
            .OrderByDescending(x => x.IsChurch)
            .ThenBy(x => x.IsClosed)
            .ThenBy(x => x.NameJson)
            .Select(x => new AdminGroupOptionDto(
                x.Id,
                x.NameJson,
                x.IsChurch,
                x.IsClosed,
                x.ParentGroupId));

        var groups = await AdminPaging.ToPagedResultAsync(groupsQuery, request.Page, request.PageSize, cancellationToken);
        return AppResult<AdminPagedResultDto<AdminGroupOptionDto>>.Success(groups);
    }
}
