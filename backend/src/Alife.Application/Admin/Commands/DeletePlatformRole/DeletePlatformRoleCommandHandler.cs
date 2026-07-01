using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Alife.Application.Admin.Commands.DeletePlatformRole;

public sealed class DeletePlatformRoleCommandHandler(IAlifeDbContext dbContext)
    : IRequestHandler<DeletePlatformRoleCommand, AppResult<AdminActionResultDto>>
{
    public async Task<AppResult<AdminActionResultDto>> Handle(
        DeletePlatformRoleCommand request,
        CancellationToken cancellationToken)
    {
        if (!await AdminPlatformRoleHelpers.HasPermissionAsync(
                dbContext,
                request.CurrentMemberId,
                AdminPermissionCatalog.ManageRolePermissions,
                cancellationToken))
        {
            return AppResult<AdminActionResultDto>.Forbidden("Only system admins can delete platform roles.");
        }

        var role = await dbContext.PlatformRoles.FirstOrDefaultAsync(x => x.Id == request.RoleId, cancellationToken);
        if (role is null)
        {
            return AppResult<AdminActionResultDto>.NotFound("Platform role was not found.");
        }

        if (AdminPlatformRoleHelpers.IsSystemRole(role.Code))
        {
            return AppResult<AdminActionResultDto>.Validation("Built-in platform roles cannot be deleted.");
        }

        var assignedMemberCount = await dbContext.MemberPlatformRoles
            .CountAsync(x => x.RoleId == role.Id, cancellationToken);
        if (assignedMemberCount > 0)
        {
            return AppResult<AdminActionResultDto>.Validation("This role is assigned to members and cannot be deleted.");
        }

        dbContext.PlatformRoles.Remove(role);
        await dbContext.AuditLogs.AddAsync(new Domain.Entities.AuditLog
        {
            Id = Guid.NewGuid(),
            ActorMemberId = request.CurrentMemberId,
            Action = "platform-role.delete",
            EntityType = "platform_role",
            BeforeJson = JsonSerializer.Serialize(new { role = role.Code, roleId = role.Id, permissions = AdminPermissionCatalog.ReadPermissions(role.Code, role.PermissionsJson) }),
            MetadataJson = JsonSerializer.Serialize(new { roleId = role.Id, role = role.Code }),
            OccurredUtc = DateTime.UtcNow
        }, cancellationToken);

        await dbContext.SaveChangesAsync(cancellationToken);
        return AppResult<AdminActionResultDto>.Success(new AdminActionResultDto(true));
    }
}
