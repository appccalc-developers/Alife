using Alife.Application.Groups.Services;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Alife.Infrastructure.Services;

public sealed class GroupAuthorizationService(AlifeDbContext dbContext) : IGroupAuthorizationService
{
    public Task<bool> IsAdminAsync(Guid memberId, CancellationToken cancellationToken)
        => dbContext.Members
            .AsNoTracking()
            .AnyAsync(x => x.Id == memberId && x.IsAdmin, cancellationToken);

    public Task<bool> IsApprovedMemberAsync(Guid groupId, Guid memberId, CancellationToken cancellationToken)
        => dbContext.GroupMemberships
            .AsNoTracking()
            .AnyAsync(
                x => x.GroupId == groupId &&
                     x.MemberId == memberId &&
                     x.Status == MembershipStatus.Approved,
                cancellationToken);

    public Task<bool> IsLeaderOrCoLeaderAsync(Guid groupId, Guid memberId, CancellationToken cancellationToken)
        => dbContext.GroupMemberships
            .AsNoTracking()
            .AnyAsync(
                x => x.GroupId == groupId &&
                     x.MemberId == memberId &&
                     x.Status == MembershipStatus.Approved &&
                     (x.Role == MembershipRole.Leader || x.Role == MembershipRole.CoLeader),
                cancellationToken);

    public Task<bool> IsLeaderAsync(Guid groupId, Guid memberId, CancellationToken cancellationToken)
        => dbContext.GroupMemberships
            .AsNoTracking()
            .AnyAsync(
                x => x.GroupId == groupId &&
                     x.MemberId == memberId &&
                     x.Status == MembershipStatus.Approved &&
                     x.Role == MembershipRole.Leader,
                cancellationToken);

    public Task<bool> IsRegisteredMemberAsync(Guid memberId, CancellationToken cancellationToken)
        => dbContext.Members
            .AsNoTracking()
            .AnyAsync(x => x.Id == memberId && x.IsRegistered, cancellationToken);
}
