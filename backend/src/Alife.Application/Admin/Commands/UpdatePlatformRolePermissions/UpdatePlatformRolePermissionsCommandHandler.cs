using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Alife.Application.Admin.Commands.UpdatePlatformRolePermissions;

public sealed class UpdatePlatformRolePermissionsCommandHandler(IAlifeDbContext dbContext)
    : IRequestHandler<UpdatePlatformRolePermissionsCommand, AppResult<AdminPlatformRoleDto>>
{
    public async Task<AppResult<AdminPlatformRoleDto>> Handle(
        UpdatePlatformRolePermissionsCommand request,
        CancellationToken cancellationToken)
    {
        if (!await AdminPlatformRoleHelpers.HasPermissionAsync(
                dbContext,
                request.CurrentMemberId,
                AdminPermissionCatalog.ManageRolePermissions,
                cancellationToken))
        {
            return AppResult<AdminPlatformRoleDto>.Forbidden("Only system admins can manage role permissions.");
        }

        var role = await dbContext.PlatformRoles.FirstOrDefaultAsync(x => x.Id == request.RoleId, cancellationToken);
        if (role is null)
        {
            return AppResult<AdminPlatformRoleDto>.NotFound("Platform role was not found.");
        }

        if (role.Code == "superadmin")
        {
            return AppResult<AdminPlatformRoleDto>.Validation("System admin always has every permission and cannot be limited.");
        }

        var beforePermissions = AdminPermissionCatalog.ReadPermissions(role.Code, role.PermissionsJson);
        var nextPermissions = AdminPermissionCatalog.NormalizePermissions(request.PermissionCodes);

        role.PermissionsJson = AdminPermissionCatalog.WritePermissions(nextPermissions);

        await dbContext.AuditLogs.AddAsync(new AuditLog
        {
            Id = Guid.NewGuid(),
            ActorMemberId = request.CurrentMemberId,
            Action = "platform-role.permissions.update",
            EntityType = "platform_role",
            BeforeJson = JsonSerializer.Serialize(new { role = role.Code, permissions = beforePermissions }),
            AfterJson = JsonSerializer.Serialize(new { role = role.Code, permissions = nextPermissions }),
            MetadataJson = JsonSerializer.Serialize(new { roleId = role.Id, role = role.Code }),
            OccurredUtc = DateTime.UtcNow
        }, cancellationToken);

        await dbContext.SaveChangesAsync(cancellationToken);

        var assignedMemberCount = role.Code == "user"
            ? await dbContext.Members.CountAsync(x => x.IsRegistered, cancellationToken)
            : await dbContext.MemberPlatformRoles.CountAsync(x => x.RoleId == role.Id && x.RevokedUtc == null, cancellationToken);
        var hasAnyAssignment = await dbContext.MemberPlatformRoles.AnyAsync(x => x.RoleId == role.Id, cancellationToken);

        return AppResult<AdminPlatformRoleDto>.Success(new AdminPlatformRoleDto(
            role.Id,
            role.Code,
            AdminPlatformRoleHelpers.ReadTextMap(role.NameJson),
            role.Level,
            AdminPermissionCatalog.ReadPermissions(role.Code, role.PermissionsJson),
            AdminPermissionCatalog.ListAll(),
            true,
            AdminPlatformRoleHelpers.IsSystemRole(role.Code),
            !AdminPlatformRoleHelpers.IsSystemRole(role.Code) &&
                !hasAnyAssignment,
            assignedMemberCount));
    }
}
