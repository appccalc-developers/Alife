using System.Text.Json;
using System.Text.Json.Nodes;

namespace Alife.Application.Notifications.Services;

internal static class MembershipNotificationActionData
{
    public const string ChurchLineMemberWaitingActionType = "church.line-member.waiting";
    public const string GroupJoinRequestReceivedActionType = "group.join-request.received";

    public static bool RequiresMembershipReview(string actionType)
        => actionType is ChurchLineMemberWaitingActionType or GroupJoinRequestReceivedActionType;

    public static string GetReviewUrl(Guid groupId, bool isChurch)
        => isChurch
            ? "/admin?church=members"
            : $"/groups/{groupId}/manage?section=members";

    public static Guid? ResolveGroupId(Guid? groupId, string actionDataJson)
    {
        if (groupId.HasValue)
        {
            return groupId;
        }

        try
        {
            var actionData = JsonNode.Parse(actionDataJson) as JsonObject;
            var value = actionData?["groupId"]?.GetValue<string>();
            return Guid.TryParse(value, out var parsedGroupId) ? parsedGroupId : null;
        }
        catch (Exception exception) when (exception is JsonException or InvalidOperationException)
        {
            return null;
        }
    }

    public static string NormalizeReviewUrl(
        string actionType,
        string actionDataJson,
        Guid groupId,
        bool isChurch)
    {
        if (!RequiresMembershipReview(actionType))
        {
            return actionDataJson;
        }

        try
        {
            var actionData = JsonNode.Parse(actionDataJson) as JsonObject;
            if (actionData is null)
            {
                return actionDataJson;
            }

            actionData["actionUrl"] = GetReviewUrl(groupId, isChurch);
            return actionData.ToJsonString();
        }
        catch (Exception exception) when (exception is JsonException or InvalidOperationException)
        {
            return actionDataJson;
        }
    }
}
