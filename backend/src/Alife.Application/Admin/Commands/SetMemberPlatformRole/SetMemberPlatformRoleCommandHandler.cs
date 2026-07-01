using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Alife.Application.Admin.Commands.SetMemberPlatformRole;

public sealed class SetMemberPlatformRoleCommandHandler(IAlifeDbContext dbContext)
    : IRequestHandler<SetMemberPlatformRoleCommand, AppResult<AdminMemberDto>>
{
    public async Task<AppResult<AdminMemberDto>> Handle(
        SetMemberPlatformRoleCommand request,
        CancellationToken cancellationToken)
    {
        if (!await AdminPlatformRoleHelpers.HasPermissionAsync(
                dbContext,
                request.CurrentMemberId,
                AdminPermissionCatalog.AssignPlatformRoles,
                cancellationToken))
        {
            return AppResult<AdminMemberDto>.Forbidden("Only super admins can change platform roles.");
        }

        var roleCodes = request.RoleCodes
            .Select(AdminPlatformRoleHelpers.NormalizeRoleCode)
            .Where(code => !string.IsNullOrWhiteSpace(code) && code != "user")
            .Distinct(StringComparer.Ordinal)
            .OrderBy(code => code, StringComparer.Ordinal)
            .ToArray();

        var target = await dbContext.Members
            .Include(x => x.PlatformRoles)
            .ThenInclude(x => x.Role)
            .FirstOrDefaultAsync(x => x.Id == request.TargetMemberId, cancellationToken);

        if (target is null)
        {
            return AppResult<AdminMemberDto>.NotFound("Member was not found.");
        }

        var now = DateTime.UtcNow;
        var activeRoles = target.PlatformRoles
            .Where(x => x.RevokedUtc is null)
            .ToList();
        var beforeRoles = activeRoles
            .OrderByDescending(x => x.Role.Level)
            .Select(x => x.Role.Code)
            .ToArray();

        var currentUserIsSuperAdmin = await AdminPlatformRoleHelpers.IsSuperAdminAsync(
            dbContext,
            request.CurrentMemberId,
            cancellationToken);
        var targetHadSuperAdmin = beforeRoles.Contains("superadmin", StringComparer.Ordinal);
        var requestIncludesSuperAdmin = roleCodes.Contains("superadmin", StringComparer.Ordinal);
        var protectedRoleCodes = new[] { "admin", "superadmin" };
        var protectedRolesChanged = protectedRoleCodes.Any(code =>
            beforeRoles.Contains(code, StringComparer.Ordinal) != roleCodes.Contains(code, StringComparer.Ordinal));

        if (!currentUserIsSuperAdmin && protectedRolesChanged)
        {
            return AppResult<AdminMemberDto>.Forbidden("Only system admins can assign or remove Admin roles.");
        }

        if (!currentUserIsSuperAdmin && request.CurrentMemberId != request.TargetMemberId && requestIncludesSuperAdmin && !targetHadSuperAdmin)
        {
            return AppResult<AdminMemberDto>.Forbidden("System admins can assign admin, but cannot promote another member to system admin from this screen.");
        }

        if (!currentUserIsSuperAdmin && request.CurrentMemberId != request.TargetMemberId && targetHadSuperAdmin && !requestIncludesSuperAdmin)
        {
            return AppResult<AdminMemberDto>.Forbidden("System admin status cannot be removed from another member on this screen.");
        }

        if (request.CurrentMemberId == request.TargetMemberId &&
            targetHadSuperAdmin &&
            !requestIncludesSuperAdmin)
        {
            return AppResult<AdminMemberDto>.Validation("A super admin cannot remove their own system admin role.");
        }

        var rolesByCode = await dbContext.PlatformRoles
            .Where(role => roleCodes.Contains(role.Code))
            .ToDictionaryAsync(role => role.Code, StringComparer.Ordinal, cancellationToken);
        var unknownRoles = roleCodes.Where(code => !rolesByCode.ContainsKey(code)).ToArray();
        if (unknownRoles.Length > 0)
        {
            return AppResult<AdminMemberDto>.Validation("One or more platform roles are not seeded.");
        }

        foreach (var activeRole in activeRoles.Where(activeRole => !roleCodes.Contains(activeRole.Role.Code, StringComparer.Ordinal)))
        {
            activeRole.RevokedUtc = now;
        }

        var beforeRoleSet = beforeRoles.ToHashSet(StringComparer.Ordinal);
        foreach (var roleCode in roleCodes.Where(code => !beforeRoleSet.Contains(code)))
        {
            var role = rolesByCode[roleCode];
            await dbContext.MemberPlatformRoles.AddAsync(new MemberPlatformRole
            {
                Id = Guid.NewGuid(),
                MemberId = target.Id,
                RoleId = role!.Id,
                AssignedByMemberId = request.CurrentMemberId,
                AssignedUtc = now
            }, cancellationToken);
        }

        target.UpdatedUtc = now;

        await dbContext.AuditLogs.AddAsync(new AuditLog
        {
            Id = Guid.NewGuid(),
            ActorMemberId = request.CurrentMemberId,
            Action = "member.platform-role.set",
            EntityType = "member",
            EntityId = target.Id,
            TargetMemberId = target.Id,
            BeforeJson = JsonSerializer.Serialize(new { roles = beforeRoles }),
            AfterJson = JsonSerializer.Serialize(new { roles = roleCodes }),
            MetadataJson = AdminPlatformRoleHelpers.RoleChangedMetadata(string.Join(",", roleCodes)),
            OccurredUtc = now
        }, cancellationToken);

        await dbContext.SaveChangesAsync(cancellationToken);

        var dto = await AdminPlatformRoleHelpers.GetAdminMemberDtoAsync(dbContext, target.Id, cancellationToken);
        return dto is null
            ? AppResult<AdminMemberDto>.NotFound("Member was not found after update.")
            : AppResult<AdminMemberDto>.Success(dto);
    }
}
