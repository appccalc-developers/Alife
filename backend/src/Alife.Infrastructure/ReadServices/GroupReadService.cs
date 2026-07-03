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

    public async Task<IReadOnlyList<GroupSummaryDto>> GetVisibleGroupsAsync(
        Guid memberId,
        CancellationToken cancellationToken)
    {
        var groups = await dbContext.Groups
            .AsNoTracking()
            .Where(group =>
                !group.IsClosed &&
                (group.IsChurch ||
                 group.AccessType != Domain.Enums.AccessType.Private ||
                 group.Memberships.Any(membership => membership.MemberId == memberId)))
            .OrderByDescending(group => group.IsChurch)
            .ThenBy(group => group.CreatedUtc)
            .ToListAsync(cancellationToken);

        return groups.Select(ToSummaryDto).ToList();
    }

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

    private static string GetPlatformRole(IReadOnlyList<string> platformRoles)
        => platformRoles.FirstOrDefault() ?? "user";

    private static IReadOnlyList<string> GetPlatformRoles(IReadOnlyList<string> platformRoles)
        => platformRoles.Count > 0 ? platformRoles : Array.Empty<string>();
}
