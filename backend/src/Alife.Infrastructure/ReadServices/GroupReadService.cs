using Alife.Application.Common;
using Alife.Application.Groups.Dtos;
using Alife.Application.Groups.Services;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Hybrid;

namespace Alife.Infrastructure.ReadServices;

public sealed class GroupReadService(AlifeDbContext dbContext, HybridCache hybridCache) : IGroupReadService
{
    public Task<GroupDto?> GetChurchAsync(CancellationToken cancellationToken)
        => GetOrCreateAsync(
            GroupCacheKeys.Church(),
            async token =>
            {
                return await dbContext.Groups
                    .AsNoTracking()
                    .Where(x => x.IsChurch)
                    .Select(x => new GroupDto(
                        x.Id,
                        x.Name,
                        x.ParentGroupId,
                        x.AccessType,
                        x.IsChurch,
                        x.IsClosed,
                        x.CreatedUtc,
                        x.UpdatedUtc))
                    .FirstOrDefaultAsync(token);
            },
            cancellationToken);

    public Task<GroupDto?> GetByIdAsync(Guid groupId, CancellationToken cancellationToken)
        => GetOrCreateAsync(
            GroupCacheKeys.ById(groupId),
            async token =>
            {
                return await dbContext.Groups
                    .AsNoTracking()
                    .Where(x => x.Id == groupId)
                    .Select(x => new GroupDto(
                        x.Id,
                        x.Name,
                        x.ParentGroupId,
                        x.AccessType,
                        x.IsChurch,
                        x.IsClosed,
                        x.CreatedUtc,
                        x.UpdatedUtc))
                    .FirstOrDefaultAsync(token);
            },
            cancellationToken);

    public Task<IReadOnlyList<GroupSummaryDto>> GetSubgroupsAsync(Guid groupId, CancellationToken cancellationToken)
        => GetOrCreateAsync(
            GroupCacheKeys.Subgroups(groupId),
            async token =>
            {
                var items = await dbContext.Groups
                    .AsNoTracking()
                    .Where(x => x.ParentGroupId == groupId && !x.IsClosed)
                    .Select(x => new GroupSummaryDto(
                        x.Id,
                        x.Name,
                        x.ParentGroupId,
                        x.AccessType,
                        x.IsChurch,
                        x.IsClosed))
                    .ToListAsync(token);

                return (IReadOnlyList<GroupSummaryDto>)items;
            },
            cancellationToken);

    public Task<IReadOnlyList<GroupMembershipDto>> GetMembershipsAsync(Guid groupId, CancellationToken cancellationToken)
        => GetOrCreateAsync(
            GroupCacheKeys.Memberships(groupId),
            async token =>
            {
                var rows = await dbContext.GroupMemberships
                    .AsNoTracking()
                    .Where(x => x.GroupId == groupId)
                    .Select(x => new
                    {
                        x.MemberId,
                        x.Status,
                        x.Role,
                        x.CreatedUtc,
                        x.UpdatedUtc
                    })
                    .ToListAsync(token);

                return (IReadOnlyList<GroupMembershipDto>)rows
                    .Select(x => new GroupMembershipDto(
                        x.MemberId,
                        EnumName.CamelCase(x.Status),
                        EnumName.CamelCase(x.Role),
                        x.CreatedUtc,
                        x.UpdatedUtc))
                    .ToList();
            },
            cancellationToken);

    private Task<T> GetOrCreateAsync<T>(
        string cacheKey,
        Func<CancellationToken, Task<T>> factory,
        CancellationToken cancellationToken)
    {
        return hybridCache.GetOrCreateAsync(
                cacheKey,
                async token => await factory(token),
                new HybridCacheEntryOptions
                {
                    Expiration = TimeSpan.FromMinutes(5),
                    LocalCacheExpiration = TimeSpan.FromMinutes(2)
                },
                cancellationToken: cancellationToken)
            .AsTask();
    }
}
