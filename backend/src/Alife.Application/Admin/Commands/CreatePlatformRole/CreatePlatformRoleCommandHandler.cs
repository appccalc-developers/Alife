using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Alife.Application.Admin.Commands.CreatePlatformRole;

public sealed class CreatePlatformRoleCommandHandler(IAlifeDbContext dbContext)
    : IRequestHandler<CreatePlatformRoleCommand, AppResult<AdminPlatformRoleDto>>
{
    public async Task<AppResult<AdminPlatformRoleDto>> Handle(
        CreatePlatformRoleCommand request,
        CancellationToken cancellationToken)
    {
        if (!await AdminPlatformRoleHelpers.HasPermissionAsync(
                dbContext,
                request.CurrentMemberId,
                AdminPermissionCatalog.ManageRolePermissions,
                cancellationToken))
        {
            return AppResult<AdminPlatformRoleDto>.Forbidden("Only system admins can create platform roles.");
        }

        var roleCode = AdminPlatformRoleHelpers.NormalizeRoleCode(request.Code);
        if (string.IsNullOrWhiteSpace(roleCode))
        {
            return AppResult<AdminPlatformRoleDto>.Validation("Role code must start with a letter and contain only lowercase letters, numbers, dots, underscores, or hyphens.");
        }

        if (AdminPlatformRoleHelpers.IsSystemRole(roleCode))
        {
            return AppResult<AdminPlatformRoleDto>.Validation("Built-in platform roles already exist.");
        }

        var nameEn = request.NameEn.Trim();
        var nameZh = request.NameZh.Trim();
        if (string.IsNullOrWhiteSpace(nameEn) || string.IsNullOrWhiteSpace(nameZh))
        {
            return AppResult<AdminPlatformRoleDto>.Validation("English and Chinese role names are required.");
        }

        if (await dbContext.PlatformRoles.AnyAsync(x => x.Code == roleCode, cancellationToken))
        {
            return AppResult<AdminPlatformRoleDto>.Validation("A role with this code already exists.");
        }

        var nextId = await dbContext.PlatformRoles
            .Select(x => (int?)x.Id)
            .MaxAsync(cancellationToken) ?? 100;
        var role = new PlatformRole
        {
            Id = nextId + 10,
            Code = roleCode,
            NameJson = AdminPlatformRoleHelpers.WriteTextMap(nameEn, nameZh),
            PermissionsJson = AdminPermissionCatalog.WritePermissions(request.PermissionCodes),
            Level = 10
        };

        await dbContext.PlatformRoles.AddAsync(role, cancellationToken);
        await dbContext.AuditLogs.AddAsync(new AuditLog
        {
            Id = Guid.NewGuid(),
            ActorMemberId = request.CurrentMemberId,
            Action = "platform-role.create",
            EntityType = "platform_role",
            AfterJson = JsonSerializer.Serialize(new { role = role.Code, roleId = role.Id, permissions = AdminPermissionCatalog.ReadPermissions(role.Code, role.PermissionsJson) }),
            MetadataJson = JsonSerializer.Serialize(new { roleId = role.Id, role = role.Code }),
            OccurredUtc = DateTime.UtcNow
        }, cancellationToken);

        await dbContext.SaveChangesAsync(cancellationToken);

        return AppResult<AdminPlatformRoleDto>.Success(new AdminPlatformRoleDto(
            role.Id,
            role.Code,
            AdminPlatformRoleHelpers.ReadTextMap(role.NameJson),
            role.Level,
            AdminPermissionCatalog.ReadPermissions(role.Code, role.PermissionsJson),
            AdminPermissionCatalog.ListAll(),
            true,
            false,
            true,
            0));
    }
}
