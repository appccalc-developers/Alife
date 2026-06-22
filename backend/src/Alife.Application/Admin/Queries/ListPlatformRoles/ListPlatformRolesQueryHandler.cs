using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Admin.Queries.ListPlatformRoles;

public sealed class ListPlatformRolesQueryHandler(IAlifeDbContext dbContext)
    : IRequestHandler<ListPlatformRolesQuery, AppResult<IReadOnlyList<AdminPlatformRoleDto>>>
{
    public async Task<AppResult<IReadOnlyList<AdminPlatformRoleDto>>> Handle(
        ListPlatformRolesQuery request,
        CancellationToken cancellationToken)
    {
        if (!await AdminPlatformRoleHelpers.IsPlatformAdminAsync(dbContext, request.CurrentMemberId, cancellationToken))
        {
            return AppResult<IReadOnlyList<AdminPlatformRoleDto>>.Forbidden("Platform admin access is required.");
        }

        var roleRows = await dbContext.PlatformRoles
            .AsNoTracking()
            .OrderBy(x => x.Level)
            .Select(x => new
            {
                x.Id,
                x.Code,
                x.NameJson,
                x.Level
            })
            .ToListAsync(cancellationToken);

        var roles = roleRows
            .Select(x => new AdminPlatformRoleDto(
                x.Id,
                x.Code,
                x.Code == "superadmin"
                    ? new Dictionary<string, string> { ["en"] = "System Admin", ["zh"] = "系统管理员" }
                    : AdminPlatformRoleHelpers.ReadTextMap(x.NameJson),
                x.Level))
            .ToList();

        return AppResult<IReadOnlyList<AdminPlatformRoleDto>>.Success(roles);
    }
}
