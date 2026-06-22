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
        if (!await AdminPlatformRoleHelpers.IsSuperAdminAsync(dbContext, request.CurrentMemberId, cancellationToken))
        {
            return AppResult<AdminMemberDto>.Forbidden("Only super admins can change platform roles.");
        }

        var roleCode = AdminPlatformRoleHelpers.NormalizeRoleCode(request.RoleCode);
        if (string.IsNullOrWhiteSpace(roleCode))
        {
            return AppResult<AdminMemberDto>.Validation("Unknown platform role.");
        }

        if (request.CurrentMemberId == request.TargetMemberId && roleCode != "superadmin")
        {
            return AppResult<AdminMemberDto>.Validation("A super admin cannot demote their own platform role.");
        }

        if (request.CurrentMemberId != request.TargetMemberId && roleCode == "superadmin")
        {
            return AppResult<AdminMemberDto>.Forbidden("System admins can assign admin, but cannot promote another member to system admin from this screen.");
        }

        var target = await dbContext.Members
            .Include(x => x.PlatformRoles)
            .ThenInclude(x => x.Role)
            .FirstOrDefaultAsync(x => x.Id == request.TargetMemberId, cancellationToken);

        if (target is null)
        {
            return AppResult<AdminMemberDto>.NotFound("Member was not found.");
        }

        var now = DateTime.UtcNow;
        var beforeRoles = target.PlatformRoles
            .Where(x => x.RevokedUtc is null)
            .OrderByDescending(x => x.Role.Level)
            .Select(x => x.Role.Code)
            .ToArray();

        foreach (var activeRole in target.PlatformRoles.Where(x => x.RevokedUtc is null))
        {
            activeRole.RevokedUtc = now;
        }

        if (roleCode != "user")
        {
            var role = await dbContext.PlatformRoles.FirstOrDefaultAsync(x => x.Code == roleCode, cancellationToken);
            if (role is null)
            {
                return AppResult<AdminMemberDto>.Validation("Platform role is not seeded.");
            }

            await dbContext.MemberPlatformRoles.AddAsync(new MemberPlatformRole
            {
                Id = Guid.NewGuid(),
                MemberId = target.Id,
                RoleId = role.Id,
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
            AfterJson = JsonSerializer.Serialize(new { role = roleCode }),
            MetadataJson = AdminPlatformRoleHelpers.RoleChangedMetadata(roleCode),
            OccurredUtc = now
        }, cancellationToken);

        await dbContext.SaveChangesAsync(cancellationToken);

        var dto = await AdminPlatformRoleHelpers.GetAdminMemberDtoAsync(dbContext, target.Id, cancellationToken);
        return dto is null
            ? AppResult<AdminMemberDto>.NotFound("Member was not found after update.")
            : AppResult<AdminMemberDto>.Success(dto);
    }
}
