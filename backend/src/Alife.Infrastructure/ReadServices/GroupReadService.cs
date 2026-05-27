using Alife.Application.Common;
using Alife.Application.Groups.Dtos;
using Alife.Application.Groups.Services;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Hybrid;
using System.Text.Json;

namespace Alife.Infrastructure.ReadServices;

public sealed class GroupReadService(AlifeDbContext dbContext, HybridCache hybridCache) : IGroupReadService
{
    public Task<GroupDto?> GetChurchAsync(CancellationToken cancellationToken)
        => GetOrCreateAsync(
            GroupCacheKeys.Church(),
            async token =>
            {
                var group = await dbContext.Groups
                    .AsNoTracking()
                    .Where(x => x.IsChurch)
                    .FirstOrDefaultAsync(token);

                return group is null ? null : ToDto(group);
            },
            cancellationToken);

    public Task<GroupDto?> GetByIdAsync(Guid groupId, CancellationToken cancellationToken)
        => GetOrCreateAsync(
            GroupCacheKeys.ById(groupId),
            async token =>
            {
                var group = await dbContext.Groups
                    .AsNoTracking()
                    .Where(x => x.Id == groupId)
                    .FirstOrDefaultAsync(token);

                return group is null ? null : ToDto(group);
            },
            cancellationToken);

    public Task<IReadOnlyList<GroupSummaryDto>> GetSubgroupsAsync(Guid groupId, CancellationToken cancellationToken)
        => GetOrCreateAsync(
            GroupCacheKeys.Subgroups(groupId),
            async token =>
            {
                var groups = await dbContext.Groups
                    .AsNoTracking()
                    .Where(x => x.ParentGroupId == groupId && !x.IsClosed)
                    .ToListAsync(token);

                return (IReadOnlyList<GroupSummaryDto>)groups.Select(ToSummaryDto).ToList();
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
                        x.Member.DisplayName,
                        x.Status,
                        x.Role,
                        x.CreatedUtc,
                        x.UpdatedUtc
                    })
                    .ToListAsync(token);

                return (IReadOnlyList<GroupMembershipDto>)rows
                    .Select(x => new GroupMembershipDto(
                        x.MemberId,
                        x.DisplayName,
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

    private static GroupDto ToDto(Domain.Entities.Group group)
        => new(
            group.Id,
            ReadTextMap(group.NameJson),
            ReadTextMap(group.DescriptionJson),
            group.ParentGroupId,
            group.AccessType,
            group.IsChurch,
            group.IsClosed,
            group.CreatedUtc,
            group.UpdatedUtc);

    private static GroupSummaryDto ToSummaryDto(Domain.Entities.Group group)
        => new(
            group.Id,
            ReadTextMap(group.NameJson),
            ReadTextMap(group.DescriptionJson),
            group.ParentGroupId,
            group.AccessType,
            group.IsChurch,
            group.IsClosed);

    private static IReadOnlyDictionary<string, string> ReadTextMap(string? value)
        => string.IsNullOrWhiteSpace(value)
            ? new Dictionary<string, string>()
            : JsonSerializer.Deserialize<Dictionary<string, string>>(value) ?? new Dictionary<string, string>();
}
