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
        if (!await AdminPlatformRoleHelpers.HasPermissionAsync(
                dbContext,
                request.CurrentMemberId,
                AdminPermissionCatalog.AccessAdmin,
                cancellationToken))
        {
            return AppResult<IReadOnlyList<AdminPlatformRoleDto>>.Forbidden("Platform admin access is required.");
        }

        var canEditPermissions = await AdminPlatformRoleHelpers.HasPermissionAsync(
            dbContext,
            request.CurrentMemberId,
            AdminPermissionCatalog.ManageRolePermissions,
            cancellationToken);

        var registeredMemberCount = await dbContext.Members
            .AsNoTracking()
            .CountAsync(x => x.IsRegistered, cancellationToken);

        var assignedRoleCounts = await dbContext.MemberPlatformRoles
            .AsNoTracking()
            .Where(x => x.RevokedUtc == null)
            .GroupBy(x => x.RoleId)
            .Select(x => new
            {
                RoleId = x.Key,
                Count = x.Count()
            })
            .ToDictionaryAsync(x => x.RoleId, x => x.Count, cancellationToken);

        var rolesWithAnyAssignment = await dbContext.MemberPlatformRoles
            .AsNoTracking()
            .Select(x => x.RoleId)
            .Distinct()
            .ToListAsync(cancellationToken);
        var roleIdsWithAnyAssignment = rolesWithAnyAssignment.ToHashSet();

        var roleRows = await dbContext.PlatformRoles
            .AsNoTracking()
            .OrderBy(x => x.Level)
            .Select(x => new
            {
                x.Id,
                x.Code,
                x.NameJson,
                x.Level,
                x.PermissionsJson
            })
            .ToListAsync(cancellationToken);

        var roles = roleRows
            .Select(x =>
            {
                var assignedMemberCount = x.Code == "user"
                    ? registeredMemberCount
                    : assignedRoleCounts.GetValueOrDefault(x.Id);

                return new AdminPlatformRoleDto(
                    x.Id,
                    x.Code,
                    x.Code == "superadmin"
                        ? AdminPlatformRoleHelpers.TextMap("System Admin", "系统管理员")
                        : AdminPlatformRoleHelpers.ReadTextMap(x.NameJson),
                    x.Level,
                    AdminPermissionCatalog.ReadPermissions(x.Code, x.PermissionsJson),
                    AdminPermissionCatalog.ListAll(),
                    canEditPermissions && x.Code != "superadmin",
                    AdminPlatformRoleHelpers.IsSystemRole(x.Code),
                    canEditPermissions && !AdminPlatformRoleHelpers.IsSystemRole(x.Code) && !roleIdsWithAnyAssignment.Contains(x.Id),
                    assignedMemberCount);
            })
            .ToList();

        return AppResult<IReadOnlyList<AdminPlatformRoleDto>>.Success(roles);
    }
}
