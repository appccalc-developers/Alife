using System.Text.Json;
using System.Text.Json.Nodes;

namespace Alife.Application.Notifications.Services;

internal static class CurrentNotificationTaskPolicy
{
    public const string UrgentCategory = "urgent";
    public const string GeneralCategory = "general";
    public const string WorkflowCompletionMode = "workflow";
    public const string ReadCompletionMode = "read";
    public const string VisitorContactRequestedActionType = "visitor.contact.requested";
    public const string LegacyGroupJoinRequestedActionType = "group.join.requested";

    public static bool IsMembershipReview(string actionType)
        => MembershipNotificationActionData.RequiresMembershipReview(actionType) ||
           actionType == LegacyGroupJoinRequestedActionType;

    public static ParsedActionData Parse(string actionDataJson)
    {
        try
        {
            using var document = JsonDocument.Parse(actionDataJson);
            if (document.RootElement.ValueKind != JsonValueKind.Object)
            {
                return ParsedActionData.Empty;
            }

            var root = document.RootElement;
            return new ParsedActionData(
                ReadGuid(root, "groupId"),
                ReadGuid(root, "memberId"),
                ReadGuid(root, "visitContactRequestId"),
                ReadString(root, "actionUrl"),
                ReadString(root, "scope"),
                ReadStringArray(root, "roleCodes"));
        }
        catch (JsonException)
        {
            return ParsedActionData.Empty;
        }
    }

    public static string WithActionUrl(string actionDataJson, string actionUrl)
    {
        try
        {
            var root = JsonNode.Parse(actionDataJson) as JsonObject;
            if (root is null)
            {
                return actionDataJson;
            }

            root["actionUrl"] = actionUrl;
            return root.ToJsonString();
        }
        catch (JsonException)
        {
            return actionDataJson;
        }
    }

    private static Guid? ReadGuid(JsonElement root, string propertyName)
        => root.TryGetProperty(propertyName, out var value) &&
           value.ValueKind == JsonValueKind.String &&
           Guid.TryParse(value.GetString(), out var parsed)
            ? parsed
            : null;

    private static string? ReadString(JsonElement root, string propertyName)
        => root.TryGetProperty(propertyName, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;

    private static IReadOnlySet<string> ReadStringArray(JsonElement root, string propertyName)
    {
        if (!root.TryGetProperty(propertyName, out var value) || value.ValueKind != JsonValueKind.Array)
        {
            return new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        }

        return value
            .EnumerateArray()
            .Where(item => item.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(item.GetString()))
            .Select(item => item.GetString()!.Trim())
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
    }

    internal sealed record ParsedActionData(
        Guid? GroupId,
        Guid? MemberId,
        Guid? VisitContactRequestId,
        string? ActionUrl,
        string? Scope,
        IReadOnlySet<string> RoleCodes)
    {
        public static ParsedActionData Empty { get; } = new(
            null,
            null,
            null,
            null,
            null,
            new HashSet<string>(StringComparer.OrdinalIgnoreCase));

        public bool IsRoleScoped => string.Equals(Scope, "role", StringComparison.OrdinalIgnoreCase);
    }
}
