using Alife.Application.Common;
using Alife.Application.Groups.Dtos;
using Alife.Application.Groups.Services;
using Alife.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Hybrid;
using System.Text.Json;

namespace Alife.Infrastructure.ReadServices;

public sealed class GroupReadService(
    AlifeDbContext dbContext,
    HybridCache hybridCache,
    IHttpContextAccessor? httpContextAccessor = null) : IGroupReadService
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

    public async Task<IReadOnlyList<GroupSummaryDto>> GetVisibleGroupsAsync(
        Guid? memberId,
        CancellationToken cancellationToken)
    {
        var discoverableGroups = await GetVisibleDiscoverableGroupsAsync(memberId.HasValue, cancellationToken);
        if (!memberId.HasValue)
        {
            return discoverableGroups.Select(item => item.Group).ToList();
        }

        // Private-group discovery is viewer-specific and authorization-sensitive.
        // Keep it out of shared caches so membership removal takes effect immediately.
        var privateGroups = await dbContext.Groups
            .AsNoTracking()
            .Where(group =>
                !group.IsClosed &&
                group.AccessType == Domain.Enums.AccessType.Private &&
                group.Memberships.Any(membership =>
                    membership.MemberId == memberId.Value &&
                    membership.Status != Domain.Enums.MembershipStatus.Rejected &&
                    membership.Status != Domain.Enums.MembershipStatus.Removed))
            .ToListAsync(cancellationToken);

        return discoverableGroups
            .Concat(privateGroups.Select(group => new VisibleGroupCacheItem(ToSummaryDto(group), group.CreatedUtc)))
            .OrderByDescending(item => item.Group.IsChurch)
            .ThenBy(item => item.CreatedUtc)
            .Select(item => item.Group)
            .ToList();
    }

    private async Task<IReadOnlyList<VisibleGroupCacheItem>> GetVisibleDiscoverableGroupsAsync(
        bool includesViewerSpecificQuery,
        CancellationToken cancellationToken)
    {
        var isMiss = false;
        var groups = await hybridCache.GetOrCreateAsync(
                GroupCacheKeys.VisibleDiscoverable(),
                async token =>
                {
                    isMiss = true;
                    var discoverableGroups = await dbContext.Groups
                        .AsNoTracking()
                        .Where(group =>
                            !group.IsClosed &&
                            group.AccessType != Domain.Enums.AccessType.Private)
                        .OrderByDescending(group => group.IsChurch)
                        .ThenBy(group => group.CreatedUtc)
                        .ToListAsync(token);

                    return discoverableGroups
                        .Select(group => new VisibleGroupCacheItem(ToSummaryDto(group), group.CreatedUtc))
                        .ToList();
                },
                new HybridCacheEntryOptions
                {
                    Expiration = TimeSpan.FromMinutes(5),
                    LocalCacheExpiration = TimeSpan.FromMinutes(2)
                },
                cancellationToken: cancellationToken)
            .AsTask();

        var response = httpContextAccessor?.HttpContext?.Response;
        if (response != null && !response.HasStarted)
        {
            response.Headers["x-alife-backend-cache"] = isMiss
                ? "MISS"
                : includesViewerSpecificQuery ? "PARTIAL_HIT" : "HIT";
        }

        return groups;
    }

    private sealed record VisibleGroupCacheItem(GroupSummaryDto Group, DateTime CreatedUtc);

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

    public Task<IReadOnlyList<GroupMembershipDto>> GetMembershipsAsync(
        Guid groupId,
        bool includeChurchLineCandidates,
        CancellationToken cancellationToken)
    {
        if (includeChurchLineCandidates)
        {
            return GetMembershipsDirectAsync(groupId, includeChurchLineCandidates, cancellationToken);
        }

        return GetOrCreateAsync(
            GroupCacheKeys.Memberships(groupId),
            token => GetMembershipsDirectAsync(groupId, includeChurchLineCandidates: false, token),
            cancellationToken);
    }

    private async Task<IReadOnlyList<GroupMembershipDto>> GetMembershipsDirectAsync(
        Guid groupId,
        bool includeChurchLineCandidates,
        CancellationToken cancellationToken)
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
                PlatformRoles = x.Member.PlatformRoles
                    .Where(role => role.RevokedUtc == null)
                    .OrderByDescending(role => role.Role.Level)
                    .Select(role => role.Role.Code)
                    .ToList(),
                x.CreatedUtc,
                x.UpdatedUtc
            })
            .ToListAsync(cancellationToken);

        var memberships = rows
            .Select(x => new GroupMembershipDto(
                x.MemberId,
                x.DisplayName,
                EnumName.CamelCase(x.Status),
                EnumName.CamelCase(x.Role),
                GetPlatformRole(x.PlatformRoles),
                GetPlatformRoles(x.PlatformRoles),
                x.CreatedUtc,
                x.UpdatedUtc))
            .ToList();

        if (!includeChurchLineCandidates)
        {
            return SortMemberships(memberships);
        }

        var isChurch = await dbContext.Groups
            .AsNoTracking()
            .AnyAsync(x => x.Id == groupId && x.IsChurch, cancellationToken);

        if (!isChurch)
        {
            return SortMemberships(memberships);
        }

        var existingMemberIds = rows.Select(x => x.MemberId).ToHashSet();
        var candidateRows = await dbContext.Members
            .AsNoTracking()
            .Where(x => x.IsRegistered && x.LineUID != null && !existingMemberIds.Contains(x.Id))
            .OrderBy(x => x.DisplayName)
            .Select(x => new
            {
                x.Id,
                x.DisplayName,
                PlatformRoles = x.PlatformRoles
                    .Where(role => role.RevokedUtc == null)
                    .OrderByDescending(role => role.Role.Level)
                    .Select(role => role.Role.Code)
                    .ToList(),
                x.CreatedUtc,
                x.UpdatedUtc
            })
            .ToListAsync(cancellationToken);

        var candidates = candidateRows
            .Select(x => new GroupMembershipDto(
                x.Id,
                x.DisplayName,
                EnumName.CamelCase(Domain.Enums.MembershipStatus.Requested),
                EnumName.CamelCase(Domain.Enums.MembershipRole.Member),
                GetPlatformRole(x.PlatformRoles),
                GetPlatformRoles(x.PlatformRoles),
                x.CreatedUtc,
                x.UpdatedUtc))
            .ToList();

        memberships.AddRange(candidates);
        return SortMemberships(memberships);
    }

    private static IReadOnlyList<GroupMembershipDto> SortMemberships(IEnumerable<GroupMembershipDto> memberships)
        => memberships
            .OrderBy(x => StatusRank(x.Status))
            .ThenByDescending(x => RoleRank(x.Role))
            .ThenByDescending(x => PlatformRoleRank(x.PlatformRole))
            .ThenBy(x => x.DisplayName ?? string.Empty)
            .ThenBy(x => x.MemberId)
            .ToList();

    private static int StatusRank(string status)
        => status switch
        {
            "requested" => 0,
            "approved" => 1,
            "invited" => 2,
            "rejected" => 3,
            "removed" => 4,
            _ => 5
        };

    private static int RoleRank(string role)
        => role switch
        {
            "leader" => 2,
            "coLeader" => 1,
            _ => 0
        };

    private static int PlatformRoleRank(string role)
        => role switch
        {
            "superadmin" => 100,
            "admin" => 10,
            _ => 0
        };

    private async Task<T> GetOrCreateAsync<T>(
        string cacheKey,
        Func<CancellationToken, Task<T>> factory,
        CancellationToken cancellationToken)
    {
        var isMiss = false;
        var result = await hybridCache.GetOrCreateAsync(
                cacheKey,
                async token =>
                {
                    isMiss = true;
                    return await factory(token);
                },
                new HybridCacheEntryOptions
                {
                    Expiration = TimeSpan.FromMinutes(5),
                    LocalCacheExpiration = TimeSpan.FromMinutes(2)
                },
                cancellationToken: cancellationToken)
            .AsTask();

        var response = httpContextAccessor?.HttpContext?.Response;
        if (response != null && !response.HasStarted)
        {
            response.Headers["x-alife-backend-cache"] = isMiss ? "MISS" : "HIT";
        }

        return result;
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

    private static string GetPlatformRole(IReadOnlyList<string> platformRoles)
        => platformRoles.FirstOrDefault() ?? "user";

    private static IReadOnlyList<string> GetPlatformRoles(IReadOnlyList<string> platformRoles)
        => platformRoles.Count > 0 ? platformRoles : Array.Empty<string>();
}
