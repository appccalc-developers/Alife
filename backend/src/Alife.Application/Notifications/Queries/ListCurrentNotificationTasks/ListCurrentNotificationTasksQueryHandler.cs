using Alife.Application.Admin;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Notifications.Dtos;
using Alife.Application.Notifications.Services;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Notifications.Queries.ListCurrentNotificationTasks;

public sealed class ListCurrentNotificationTasksQueryHandler(IAlifeDbContext dbContext)
    : IRequestHandler<ListCurrentNotificationTasksQuery, AppResult<IReadOnlyList<CurrentNotificationTaskDto>>>
{
    private static readonly string[] WorkflowActionTypes =
    [
        MembershipNotificationActionData.ChurchLineMemberWaitingActionType,
        MembershipNotificationActionData.GroupJoinRequestReceivedActionType,
        CurrentNotificationTaskPolicy.LegacyGroupJoinRequestedActionType,
        CurrentNotificationTaskPolicy.VisitorContactRequestedActionType
    ];

    public async Task<AppResult<IReadOnlyList<CurrentNotificationTaskDto>>> Handle(
        ListCurrentNotificationTasksQuery request,
        CancellationToken cancellationToken)
    {
        var notifications = await dbContext.NotificationMessages
            .AsNoTracking()
            .Where(notification =>
                notification.RecipientMemberId == request.CurrentMemberId &&
                (!notification.ReadUtc.HasValue || WorkflowActionTypes.Contains(notification.ActionType)))
            .OrderByDescending(notification => notification.OccurredUtc)
            .Select(notification => new CandidateNotification(
                notification.Id,
                notification.RecipientMemberId,
                notification.CreatedByMemberId,
                notification.GroupId,
                notification.EventId,
                notification.OccurredUtc,
                notification.ActionType,
                notification.ActionDataJson,
                notification.ResponseDataJson,
                notification.ReadUtc,
                notification.RepliedUtc,
                notification.CreatedUtc,
                notification.UpdatedUtc,
                notification.AnnouncementId))
            .ToListAsync(cancellationToken);

        if (notifications.Count == 0)
        {
            return AppResult<IReadOnlyList<CurrentNotificationTaskDto>>.Success([]);
        }

        var parsedNotifications = notifications
            .Select(notification => new ParsedNotification(
                notification,
                CurrentNotificationTaskPolicy.Parse(notification.ActionDataJson)))
            .ToArray();

        var membershipNotifications = parsedNotifications
            .Where(item => CurrentNotificationTaskPolicy.IsMembershipReview(item.Notification.ActionType))
            .ToArray();
        var membershipGroupIds = membershipNotifications
            .Select(item => item.Notification.GroupId ?? item.ActionData.GroupId)
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .Distinct()
            .ToArray();
        var membershipMemberIds = membershipNotifications
            .Select(item => item.ActionData.MemberId)
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .Distinct()
            .ToArray();

        var leaderGroupIds = membershipGroupIds.Length == 0
            ? new HashSet<Guid>()
            : (await dbContext.GroupMemberships
                .AsNoTracking()
                .Where(membership =>
                    membership.MemberId == request.CurrentMemberId &&
                    membership.Status == MembershipStatus.Approved &&
                    (membership.Role == MembershipRole.Leader || membership.Role == MembershipRole.CoLeader) &&
                    membershipGroupIds.Contains(membership.GroupId))
                .Select(membership => membership.GroupId)
                .ToListAsync(cancellationToken))
                .ToHashSet();

        var requestedMemberships = membershipGroupIds.Length == 0 || membershipMemberIds.Length == 0
            ? new HashSet<(Guid GroupId, Guid MemberId)>()
            : (await dbContext.GroupMemberships
                .AsNoTracking()
                .Where(membership =>
                    membership.Status == MembershipStatus.Requested &&
                    membershipGroupIds.Contains(membership.GroupId) &&
                    membershipMemberIds.Contains(membership.MemberId))
                .Select(membership => new { membership.GroupId, membership.MemberId })
                .ToListAsync(cancellationToken))
                .Select(membership => (membership.GroupId, membership.MemberId))
                .ToHashSet();

        var groupScopes = membershipGroupIds.Length == 0
            ? new Dictionary<Guid, bool>()
            : await dbContext.Groups
                .AsNoTracking()
                .Where(group => membershipGroupIds.Contains(group.Id))
                .ToDictionaryAsync(group => group.Id, group => group.IsChurch, cancellationToken);

        var visitorRequestIds = parsedNotifications
            .Where(item => item.Notification.ActionType == CurrentNotificationTaskPolicy.VisitorContactRequestedActionType)
            .Select(item => item.ActionData.VisitContactRequestId)
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .Distinct()
            .ToArray();
        var visitorRequestStatuses = visitorRequestIds.Length == 0
            ? new Dictionary<Guid, string>()
            : await dbContext.VisitContactRequests
                .AsNoTracking()
                .Where(contactRequest => visitorRequestIds.Contains(contactRequest.Id))
                .ToDictionaryAsync(contactRequest => contactRequest.Id, contactRequest => contactRequest.Status, cancellationToken);
        var canReceiveVisitorRequests = visitorRequestIds.Length > 0 &&
            await AdminPlatformRoleHelpers.HasPermissionAsync(
                dbContext,
                request.CurrentMemberId,
                AdminPermissionCatalog.ReceiveVisitorContactRequests,
                cancellationToken);

        var activeRoleCodes = parsedNotifications.Any(item => item.ActionData.IsRoleScoped)
            ? (await dbContext.MemberPlatformRoles
                .AsNoTracking()
                .Where(memberRole => memberRole.MemberId == request.CurrentMemberId && memberRole.RevokedUtc == null)
                .Select(memberRole => memberRole.Role.Code)
                .ToListAsync(cancellationToken))
                .ToHashSet(StringComparer.OrdinalIgnoreCase)
            : new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        var currentTasks = new List<CurrentNotificationTaskDto>();
        foreach (var item in parsedNotifications)
        {
            var notification = item.Notification;
            var actionDataJson = notification.ActionDataJson;
            string category;
            string completionMode;

            if (CurrentNotificationTaskPolicy.IsMembershipReview(notification.ActionType))
            {
                var groupId = notification.GroupId ?? item.ActionData.GroupId;
                var memberId = item.ActionData.MemberId;
                if (!groupId.HasValue || !memberId.HasValue ||
                    !leaderGroupIds.Contains(groupId.Value) ||
                    !requestedMemberships.Contains((groupId.Value, memberId.Value)) ||
                    !groupScopes.TryGetValue(groupId.Value, out var isChurch))
                {
                    continue;
                }

                actionDataJson = MembershipNotificationActionData.NormalizeReviewUrl(
                    notification.ActionType == CurrentNotificationTaskPolicy.LegacyGroupJoinRequestedActionType
                        ? MembershipNotificationActionData.GroupJoinRequestReceivedActionType
                        : notification.ActionType,
                    actionDataJson,
                    groupId.Value,
                    isChurch);
                category = CurrentNotificationTaskPolicy.UrgentCategory;
                completionMode = CurrentNotificationTaskPolicy.WorkflowCompletionMode;
            }
            else if (notification.ActionType == CurrentNotificationTaskPolicy.VisitorContactRequestedActionType)
            {
                var requestId = item.ActionData.VisitContactRequestId;
                if (!canReceiveVisitorRequests || !requestId.HasValue ||
                    !visitorRequestStatuses.TryGetValue(requestId.Value, out var status) ||
                    string.Equals(status, "contacted", StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                actionDataJson = CurrentNotificationTaskPolicy.WithActionUrl(actionDataJson, "/admin/visit-requests");
                category = CurrentNotificationTaskPolicy.UrgentCategory;
                completionMode = CurrentNotificationTaskPolicy.WorkflowCompletionMode;
            }
            else if (item.ActionData.IsRoleScoped)
            {
                if (notification.ReadUtc.HasValue || item.ActionData.RoleCodes.Count == 0 ||
                    !item.ActionData.RoleCodes.Overlaps(activeRoleCodes))
                {
                    continue;
                }

                category = CurrentNotificationTaskPolicy.UrgentCategory;
                completionMode = CurrentNotificationTaskPolicy.ReadCompletionMode;
            }
            else
            {
                if (notification.ReadUtc.HasValue)
                {
                    continue;
                }

                category = CurrentNotificationTaskPolicy.GeneralCategory;
                completionMode = CurrentNotificationTaskPolicy.ReadCompletionMode;
            }

            var parsedActionData = CurrentNotificationTaskPolicy.Parse(actionDataJson);
            var actionUrl = parsedActionData.ActionUrl;
            if (string.IsNullOrWhiteSpace(actionUrl) &&
                notification.ActionType == "event.created" &&
                notification.GroupId.HasValue && notification.EventId.HasValue)
            {
                actionUrl = $"/groups/{notification.GroupId.Value}/events/{notification.EventId.Value}";
            }

            currentTasks.Add(new CurrentNotificationTaskDto(
                notification.Id,
                notification.RecipientMemberId,
                notification.CreatedByMemberId,
                notification.GroupId,
                notification.EventId,
                notification.OccurredUtc,
                notification.ActionType,
                actionDataJson,
                notification.ResponseDataJson,
                notification.ReadUtc,
                notification.RepliedUtc,
                notification.CreatedUtc,
                notification.UpdatedUtc,
                notification.AnnouncementId,
                category,
                completionMode,
                actionUrl));
        }

        return AppResult<IReadOnlyList<CurrentNotificationTaskDto>>.Success(currentTasks);
    }

    private sealed record CandidateNotification(
        Guid Id,
        Guid RecipientMemberId,
        Guid CreatedByMemberId,
        Guid? GroupId,
        Guid? EventId,
        DateTime OccurredUtc,
        string ActionType,
        string ActionDataJson,
        string? ResponseDataJson,
        DateTime? ReadUtc,
        DateTime? RepliedUtc,
        DateTime CreatedUtc,
        DateTime UpdatedUtc,
        Guid? AnnouncementId);

    private sealed record ParsedNotification(
        CandidateNotification Notification,
        CurrentNotificationTaskPolicy.ParsedActionData ActionData);
}
