using System.Text.Json;
using Alife.Application.Common.Interfaces;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Notifications.Services;

public static class MembershipNotificationWriter
{
    public static async Task NotifyChurchLeadersOfLineRegistrationAsync(
        IAlifeDbContext dbContext,
        Guid memberId,
        string? memberDisplayName,
        CancellationToken cancellationToken)
    {
        var church = await dbContext.Groups
            .AsNoTracking()
            .Where(x => x.IsChurch)
            .Select(x => new GroupInfo(x.Id, x.NameJson))
            .FirstOrDefaultAsync(cancellationToken);

        if (church is null)
        {
            return;
        }

        var recipientIds = await GetLeaderRecipientIdsAsync(dbContext, church.Id, memberId, cancellationToken);
        if (recipientIds.Count == 0)
        {
            return;
        }

        var memberName = CleanName(memberDisplayName);
        var actionDataJson = Serialize(new
        {
            groupId = church.Id,
            memberId,
            title = new
            {
                en = "New LINE member is waiting",
                zh = "有新的 LINE 用户等待处理"
            },
            body = new
            {
                en = $"{memberName} signed in with LINE. Review church membership and invite or approve them.",
                zh = $"{memberName} 已使用 LINE 登录。请审核教会成员资格，并邀请或批准加入。"
            },
            actionUrl = $"/groups/{church.Id}/manage"
        });

        AddNotifications(dbContext, recipientIds, memberId, church.Id, "church.line-member.waiting", actionDataJson);
    }

    public static async Task NotifyGroupLeadersOfJoinRequestAsync(
        IAlifeDbContext dbContext,
        Guid groupId,
        Guid requesterMemberId,
        CancellationToken cancellationToken)
    {
        var group = await GetGroupInfoAsync(dbContext, groupId, cancellationToken);
        if (group is null)
        {
            return;
        }

        var requesterName = await GetMemberDisplayNameAsync(dbContext, requesterMemberId, cancellationToken);
        var recipientIds = await GetLeaderRecipientIdsAsync(dbContext, groupId, requesterMemberId, cancellationToken);
        if (recipientIds.Count == 0)
        {
            return;
        }

        var groupName = ReadLocalizedText(group.NameJson, "Group", "小组");
        var memberName = CleanName(requesterName);
        var actionDataJson = Serialize(new
        {
            groupId,
            memberId = requesterMemberId,
            title = new
            {
                en = "New group join request",
                zh = "新的小组加入申请"
            },
            body = new
            {
                en = $"{memberName} requested to join {groupName.En}.",
                zh = $"{memberName} 申请加入 {groupName.Zh}。"
            },
            actionUrl = $"/groups/{groupId}/manage"
        });

        AddNotifications(dbContext, recipientIds, requesterMemberId, groupId, "group.join-request.received", actionDataJson);
    }

    public static async Task NotifyMemberOfGroupInvitationAsync(
        IAlifeDbContext dbContext,
        Guid groupId,
        Guid invitedMemberId,
        Guid invitedByMemberId,
        CancellationToken cancellationToken)
    {
        var group = await GetGroupInfoAsync(dbContext, groupId, cancellationToken);
        if (group is null)
        {
            return;
        }

        var groupName = ReadLocalizedText(group.NameJson, "Group", "小组");
        var actionDataJson = Serialize(new
        {
            groupId,
            title = new
            {
                en = "Group invitation",
                zh = "小组邀请"
            },
            body = new
            {
                en = $"You have been invited to join {groupName.En}.",
                zh = $"你被邀请加入 {groupName.Zh}。"
            },
            actionUrl = "/profile"
        });

        AddNotification(dbContext, invitedMemberId, invitedByMemberId, groupId, "group.invitation.received", actionDataJson);
    }

    public static async Task NotifyMemberOfGroupRemovalAsync(
        IAlifeDbContext dbContext,
        Guid groupId,
        Guid removedMemberId,
        Guid changedByMemberId,
        CancellationToken cancellationToken)
    {
        var group = await GetGroupInfoAsync(dbContext, groupId, cancellationToken);
        if (group is null)
        {
            return;
        }

        var groupName = ReadLocalizedText(group.NameJson, "Group", "小组");
        var actionDataJson = Serialize(new
        {
            groupId,
            title = new
            {
                en = "Group membership removed",
                zh = "小组成员资格已移除"
            },
            body = new
            {
                en = $"Your membership in {groupName.En} has been removed.",
                zh = $"你在 {groupName.Zh} 的成员资格已被移除。"
            }
        });

        AddNotification(dbContext, removedMemberId, changedByMemberId, groupId, "group.member.removed", actionDataJson);
    }

    public static async Task NotifyMemberOfGroupRoleChangedAsync(
        IAlifeDbContext dbContext,
        Guid groupId,
        Guid memberId,
        Guid changedByMemberId,
        bool isCoLeader,
        CancellationToken cancellationToken)
    {
        var group = await GetGroupInfoAsync(dbContext, groupId, cancellationToken);
        if (group is null)
        {
            return;
        }

        var groupName = ReadLocalizedText(group.NameJson, "Group", "小组");
        var actionType = isCoLeader ? "group.member.promoted-to-coleader" : "group.member.demoted-to-member";
        var actionDataJson = Serialize(new
        {
            groupId,
            role = isCoLeader ? "coLeader" : "member",
            title = new
            {
                en = isCoLeader ? "You are now a co-leader" : "Your group role changed",
                zh = isCoLeader ? "你已成为共同带领人" : "你的小组角色已变更"
            },
            body = new
            {
                en = isCoLeader
                    ? $"You have been set as a co-leader of {groupName.En}."
                    : $"You are now a member of {groupName.En}.",
                zh = isCoLeader
                    ? $"你已被设为 {groupName.Zh} 的共同带领人。"
                    : $"你现在是 {groupName.Zh} 的组员。"
            }
        });

        AddNotification(dbContext, memberId, changedByMemberId, groupId, actionType, actionDataJson);
    }

    private static async Task<GroupInfo?> GetGroupInfoAsync(
        IAlifeDbContext dbContext,
        Guid groupId,
        CancellationToken cancellationToken)
        => await dbContext.Groups
            .AsNoTracking()
            .Where(x => x.Id == groupId)
            .Select(x => new GroupInfo(x.Id, x.NameJson))
            .FirstOrDefaultAsync(cancellationToken);

    private static async Task<string?> GetMemberDisplayNameAsync(
        IAlifeDbContext dbContext,
        Guid memberId,
        CancellationToken cancellationToken)
        => await dbContext.Members
            .AsNoTracking()
            .Where(x => x.Id == memberId)
            .Select(x => x.DisplayName)
            .FirstOrDefaultAsync(cancellationToken);

    private static async Task<List<Guid>> GetLeaderRecipientIdsAsync(
        IAlifeDbContext dbContext,
        Guid groupId,
        Guid excludeMemberId,
        CancellationToken cancellationToken)
        => await (
                from membership in dbContext.GroupMemberships.AsNoTracking()
                join member in dbContext.Members.AsNoTracking() on membership.MemberId equals member.Id
                where membership.GroupId == groupId &&
                      membership.Status == MembershipStatus.Approved &&
                      (membership.Role == MembershipRole.Leader || membership.Role == MembershipRole.CoLeader) &&
                      membership.MemberId != excludeMemberId &&
                      member.IsRegistered
                select membership.MemberId)
            .Distinct()
            .ToListAsync(cancellationToken);

    private static void AddNotifications(
        IAlifeDbContext dbContext,
        IEnumerable<Guid> recipientMemberIds,
        Guid createdByMemberId,
        Guid groupId,
        string actionType,
        string actionDataJson)
    {
        foreach (var recipientMemberId in recipientMemberIds)
        {
            AddNotification(dbContext, recipientMemberId, createdByMemberId, groupId, actionType, actionDataJson);
        }
    }

    private static void AddNotification(
        IAlifeDbContext dbContext,
        Guid recipientMemberId,
        Guid createdByMemberId,
        Guid groupId,
        string actionType,
        string actionDataJson)
    {
        var now = DateTime.UtcNow;
        dbContext.NotificationMessages.Add(new NotificationMessage
        {
            Id = Guid.NewGuid(),
            RecipientMemberId = recipientMemberId,
            CreatedByMemberId = createdByMemberId,
            GroupId = groupId,
            OccurredUtc = now,
            ActionType = actionType,
            ActionDataJson = actionDataJson,
            CreatedUtc = now,
            UpdatedUtc = now
        });
    }

    private static string Serialize<T>(T value)
        => JsonSerializer.Serialize(value);

    private static string CleanName(string? value)
        => string.IsNullOrWhiteSpace(value) ? "This member" : value.Trim();

    private static LocalizedText ReadLocalizedText(string json, string fallbackEn, string fallbackZh)
    {
        try
        {
            var value = JsonSerializer.Deserialize<Dictionary<string, string>>(json);
            var en = ReadText(value, "en") ?? ReadText(value, "zh") ?? fallbackEn;
            var zh = ReadText(value, "zh") ?? ReadText(value, "en") ?? fallbackZh;
            return new LocalizedText(en, zh);
        }
        catch (JsonException)
        {
            return new LocalizedText(fallbackEn, fallbackZh);
        }
    }

    private static string? ReadText(Dictionary<string, string>? value, string key)
        => value is not null && value.TryGetValue(key, out var text) && !string.IsNullOrWhiteSpace(text)
            ? text.Trim()
            : null;

    private sealed record GroupInfo(Guid Id, string NameJson);
    private sealed record LocalizedText(string En, string Zh);
}
