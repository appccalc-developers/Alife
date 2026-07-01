using Alife.Application.Groups.Services;
using Alife.Application.Admin;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Alife.Infrastructure.Services;

public sealed class GroupAuthorizationService(AlifeDbContext dbContext) : IGroupAuthorizationService
{
    public async Task<bool> IsAdminAsync(Guid memberId, CancellationToken cancellationToken)
    {
        var roles = await dbContext.MemberPlatformRoles
            .AsNoTracking()
            .Where(x => x.MemberId == memberId && x.RevokedUtc == null)
            .Select(x => new
            {
                x.Role.Code,
                x.Role.PermissionsJson
            })
            .ToListAsync(cancellationToken);

        return roles.Any(role =>
            role.Code == "superadmin" ||
            Alife.Application.Admin.AdminPermissionCatalog.ReadPermissions(role.Code, role.PermissionsJson)
                .Contains(Alife.Application.Admin.AdminPermissionCatalog.AccessAdmin));
    }

    public async Task<bool> CanReviewPagesAsync(Guid memberId, CancellationToken cancellationToken)
    {
        var roles = await dbContext.MemberPlatformRoles
            .AsNoTracking()
            .Where(x => x.MemberId == memberId && x.RevokedUtc == null)
            .Select(x => new
            {
                x.RoleId,
                x.Role.Code,
                x.Role.PermissionsJson
            })
            .ToListAsync(cancellationToken);

        return roles.Any(role =>
            role.RoleId == (int)PlatformRoleId.PageReviewer ||
            role.RoleId == (int)PlatformRoleId.SuperAdmin ||
            AdminPermissionCatalog.ReadPermissions(role.Code, role.PermissionsJson)
                .Contains(AdminPermissionCatalog.ReviewPages));
    }

    public async Task<bool> IsApprovedMemberAsync(Guid groupId, Guid memberId, CancellationToken cancellationToken)
    {
        if (await IsAdminAsync(memberId, cancellationToken))
        {
            return true;
        }

        return await dbContext.GroupMemberships
            .AsNoTracking()
            .AnyAsync(
                x => x.GroupId == groupId &&
                     x.MemberId == memberId &&
                     x.Status == MembershipStatus.Approved,
                cancellationToken);
    }

    public async Task<bool> IsLeaderOrCoLeaderAsync(Guid groupId, Guid memberId, CancellationToken cancellationToken)
    {
        if (await IsAdminAsync(memberId, cancellationToken))
        {
            return true;
        }

        return await dbContext.GroupMemberships
            .AsNoTracking()
            .AnyAsync(
                x => x.GroupId == groupId &&
                     x.MemberId == memberId &&
                     x.Status == MembershipStatus.Approved &&
                     (x.Role == MembershipRole.Leader || x.Role == MembershipRole.CoLeader),
                cancellationToken);
    }

    public async Task<bool> IsLeaderAsync(Guid groupId, Guid memberId, CancellationToken cancellationToken)
    {
        if (await IsAdminAsync(memberId, cancellationToken))
        {
            return true;
        }

        return await dbContext.GroupMemberships
            .AsNoTracking()
            .AnyAsync(
                x => x.GroupId == groupId &&
                     x.MemberId == memberId &&
                     x.Status == MembershipStatus.Approved &&
                     x.Role == MembershipRole.Leader,
                cancellationToken);
    }

    public Task<bool> IsRegisteredMemberAsync(Guid memberId, CancellationToken cancellationToken)
        => dbContext.Members
            .AsNoTracking()
            .AnyAsync(x => x.Id == memberId && x.IsRegistered, cancellationToken);
}
