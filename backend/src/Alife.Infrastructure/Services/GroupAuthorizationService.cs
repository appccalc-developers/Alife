using Alife.Application.Groups.Services;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Alife.Infrastructure.Services;

public sealed class GroupAuthorizationService(AlifeDbContext dbContext) : IGroupAuthorizationService
{
    public async Task<bool> IsAdminAsync(Guid memberId, CancellationToken cancellationToken)
    {
        return await dbContext.MemberPlatformRoles
            .AsNoTracking()
            .AnyAsync(
                x => x.MemberId == memberId &&
                     x.RevokedUtc == null &&
                     (x.RoleId == (int)PlatformRoleId.Admin || x.RoleId == (int)PlatformRoleId.SuperAdmin),
                cancellationToken);
    }

    public async Task<bool> CanReviewPagesAsync(Guid memberId, CancellationToken cancellationToken)
    {
        return await dbContext.MemberPlatformRoles
            .AsNoTracking()
            .AnyAsync(
                x => x.MemberId == memberId &&
                     x.RevokedUtc == null &&
                     (x.RoleId == (int)PlatformRoleId.PageReviewer ||
                      x.RoleId == (int)PlatformRoleId.Admin ||
                      x.RoleId == (int)PlatformRoleId.SuperAdmin),
                cancellationToken);
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
