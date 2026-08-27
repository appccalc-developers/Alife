using System.Text.Json;
using System.Text.Json.Nodes;
using Alife.Application.Events.Dtos;
using Alife.Domain.Enums;

namespace Alife.Application.Events.Services;

public static class EventVisibilityPolicy
{
    public const string GroupVisible = "groupVisible";
    public const string ChurchVisible = "churchVisible";
    public const string Public = "public";

    private static readonly string[] PublicEventDataFields =
    [
        "title",
        "description",
        "purpose",
        "locationName",
        "startDate",
        "endDate",
        "registrationDeadline",
        "maxCapacity",
        "capacityUnit",
        "hardConstraints",
        "optionalActivities",
        "baseFeePerAdult",
        "baseFeePerChild",
        "currency",
        "posterImageUrl",
        "galleryUrls",
        "legacySummary",
        "visibility"
    ];

    public static bool TryReadVisibility(string eventDataJson, out string visibility)
    {
        visibility = GroupVisible;
        try
        {
            var root = JsonNode.Parse(eventDataJson) as JsonObject;
            if (root is null)
            {
                return false;
            }

            var raw = root["visibility"]?.GetValue<string>();
            if (string.IsNullOrWhiteSpace(raw))
            {
                return true;
            }

            visibility = raw.Trim() switch
            {
                var value when value.Equals(GroupVisible, StringComparison.OrdinalIgnoreCase) => GroupVisible,
                var value when value.Equals(ChurchVisible, StringComparison.OrdinalIgnoreCase) => ChurchVisible,
                var value when value.Equals(Public, StringComparison.OrdinalIgnoreCase) => Public,
                _ => string.Empty
            };
            return visibility.Length > 0;
        }
        catch (JsonException)
        {
            return false;
        }
        catch (InvalidOperationException)
        {
            return false;
        }
    }

    public static string ReadVisibility(string eventDataJson)
        => TryReadVisibility(eventDataJson, out var visibility) ? visibility : GroupVisible;

    public static bool CanView(
        string visibility,
        bool isGroupMember,
        bool isChurchMember)
        => visibility switch
        {
            Public => true,
            ChurchVisible => isGroupMember || isChurchMember,
            _ => isGroupMember
        };

    public static GroupEventSummaryDto SanitizeForExpandedAudience(GroupEventSummaryDto source)
        => source with
        {
            CreatedByMemberId = Guid.Empty,
            EventDataJson = CreatePublicEventDataJson(source.EventDataJson),
            ContactProfileIds = [],
            Visibility = ReadVisibility(source.EventDataJson)
        };

    public static string CreatePublicEventDataJson(string eventDataJson)
    {
        try
        {
            var source = JsonNode.Parse(eventDataJson) as JsonObject;
            if (source is null)
            {
                return "{}";
            }

            var result = new JsonObject();
            foreach (var field in PublicEventDataFields)
            {
                if (source[field] is { } value)
                {
                    result[field] = value.DeepClone();
                }
            }

            return result.ToJsonString();
        }
        catch (JsonException)
        {
            return "{}";
        }
    }

    public static bool IsPublished(GroupEventSummaryDto groupEvent)
        => groupEvent.RamStatus == EventRamStatus.Approved &&
           (groupEvent.GovernanceMode != EventGovernanceMode.ChurchSponsored ||
            groupEvent.SponsorshipStatus == EventSponsorshipStatus.Approved);
}
