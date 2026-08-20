using System.Text.Json;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.ChurchLife;

public sealed class ChurchLifeScopeService(IAlifeDbContext db) : IChurchLifeScopeService
{
    public async Task<AppResult<ChurchLifeScope>> GetScopeAsync(Guid memberId, CancellationToken cancellationToken)
    {
        var isRegistered = await db.Members
            .AsNoTracking()
            .AnyAsync(x => x.Id == memberId && x.IsRegistered, cancellationToken);
        if (!isRegistered)
        {
            return AppResult<ChurchLifeScope>.Forbidden("Church Life is available to registered members.");
        }

        var groups = await db.Groups
            .AsNoTracking()
            .Select(x => new ScopeRow(
                x.Id,
                x.ParentGroupId,
                x.NameJson,
                x.AccessType,
                x.IsChurch,
                x.IsClosed,
                x.CreatedUtc))
            .ToListAsync(cancellationToken);

        var root = groups
            .Where(x => x.IsChurch && !x.IsClosed)
            .OrderBy(x => x.CreatedUtc)
            .ThenBy(x => x.Id)
            .FirstOrDefault();
        if (root is null)
        {
            return AppResult<ChurchLifeScope>.NotFound("Church group was not found.");
        }

        var childrenByParent = groups
            .Where(x => x.ParentGroupId.HasValue)
            .GroupBy(x => x.ParentGroupId!.Value)
            .ToDictionary(x => x.Key, x => x.OrderBy(child => child.CreatedUtc).ThenBy(child => child.Id).ToList());
        var visited = new HashSet<Guid>();
        var openTree = new List<(ScopeRow Group, IReadOnlyList<Guid> PathIds)>();
        var stack = new Stack<(ScopeRow Group, IReadOnlyList<Guid> PathIds)>();
        stack.Push((root, new[] { root.Id }));

        while (stack.Count > 0)
        {
            var current = stack.Pop();
            if (current.Group.IsClosed || !visited.Add(current.Group.Id))
            {
                continue;
            }

            openTree.Add(current);
            if (!childrenByParent.TryGetValue(current.Group.Id, out var children))
            {
                continue;
            }

            for (var index = children.Count - 1; index >= 0; index--)
            {
                var child = children[index];
                if (!child.IsClosed && !visited.Contains(child.Id))
                {
                    stack.Push((child, current.PathIds.Append(child.Id).ToArray()));
                }
            }
        }

        var openGroupIds = visited.ToList();
        var memberships = await db.GroupMemberships
            .AsNoTracking()
            .Where(x =>
                x.MemberId == memberId &&
                x.Status == MembershipStatus.Approved &&
                openGroupIds.Contains(x.GroupId))
            .Select(x => new { x.GroupId, x.Role })
            .ToListAsync(cancellationToken);
        var approvedGroupIds = memberships.Select(x => x.GroupId).ToHashSet();
        var managedGroupIds = memberships
            .Where(x => x.Role == MembershipRole.Leader || x.Role == MembershipRole.CoLeader)
            .Select(x => x.GroupId)
            .ToHashSet();

        var scopeGroups = openTree
            .Select(x => new ChurchLifeScopeGroup(
                x.Group.Id,
                x.Group.ParentGroupId,
                ReadTextMap(x.Group.NameJson),
                x.Group.AccessType,
                x.PathIds,
                managedGroupIds.Contains(x.Group.Id)))
            .ToList();

        return AppResult<ChurchLifeScope>.Success(new ChurchLifeScope(root.Id, scopeGroups, approvedGroupIds));
    }

    private static IReadOnlyDictionary<string, string> ReadTextMap(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return new Dictionary<string, string>();
        }

        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, string>>(value) ?? [];
        }
        catch (JsonException)
        {
            return new Dictionary<string, string> { ["en"] = value };
        }
    }

    private sealed record ScopeRow(
        Guid Id,
        Guid? ParentGroupId,
        string NameJson,
        AccessType AccessType,
        bool IsChurch,
        bool IsClosed,
        DateTime CreatedUtc);
}
