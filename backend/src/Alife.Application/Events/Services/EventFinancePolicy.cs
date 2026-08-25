using System.Text.Json;
using System.Text.Json.Nodes;
using Alife.Domain.Entities;
using Alife.Domain.Enums;

namespace Alife.Application.Events.Services;

public sealed record EventFinanceText(string En, string Zh)
{
    public bool IsComplete => !string.IsNullOrWhiteSpace(En) && !string.IsNullOrWhiteSpace(Zh);
}

public sealed record EventFinanceOption(string Id, EventFinanceText Name, decimal ExtraFee);

public sealed record EventFinanceSettings(
    string Currency,
    decimal? AdultFee,
    decimal? ChildFee,
    EventFinanceText PaymentInstructions,
    EventFinanceText RefundPolicy,
    bool PaymentEvidenceRequired,
    bool LeaderConfirmed,
    IReadOnlyList<EventFinanceOption> Options)
{
    public bool HasCharges => AdultFee > 0 || ChildFee > 0 || Options.Any(x => x.ExtraFee > 0);
}

public static class EventFinancePolicy
{
    private static readonly string[] MaterialFields =
    [
        "baseFeePerAdult", "baseFeePerChild", "currency", "optionalActivities",
        "paymentInstructions", "refundPolicy", "paymentEvidenceRequired"
    ];

    public static bool IsEnabled(GroupEvent groupEvent)
        => EventCompositionFactory.UsesOptionalModule(groupEvent.EventDataJson, "finance");

    public static string ForceUnconfirmed(string eventDataJson)
    {
        var root = JsonNode.Parse(eventDataJson) as JsonObject ?? throw new JsonException("Event data must be an object.");
        if (HasFinanceFields(root) || root.ContainsKey("financeLeaderConfirmed"))
            root["financeLeaderConfirmed"] = false;
        return root.ToJsonString();
    }

    public static string ProtectConfirmation(string currentEventDataJson, string nextEventDataJson)
    {
        var current = JsonNode.Parse(currentEventDataJson) as JsonObject ?? throw new JsonException("Current event data must be an object.");
        var next = JsonNode.Parse(nextEventDataJson) as JsonObject ?? throw new JsonException("Event data must be an object.");
        var changed = MaterialFields.Any(field => !JsonNode.DeepEquals(current[field], next[field]));
        var wasConfirmed = current["financeLeaderConfirmed"] is JsonValue confirmation
            && confirmation.TryGetValue<bool>(out var confirmed)
            && confirmed;
        if (HasFinanceFields(current) || HasFinanceFields(next) || current.ContainsKey("financeLeaderConfirmed") || next.ContainsKey("financeLeaderConfirmed"))
            next["financeLeaderConfirmed"] = !changed && wasConfirmed;
        else
            next.Remove("financeLeaderConfirmed");
        return next.ToJsonString();
    }

    private static bool HasFinanceFields(JsonObject value)
        => MaterialFields.Any(value.ContainsKey);

    public static bool TryReadSettings(GroupEvent groupEvent, out EventFinanceSettings settings, out string error)
    {
        settings = Empty();
        error = string.Empty;
        try
        {
            using var document = JsonDocument.Parse(groupEvent.EventDataJson);
            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
            {
                error = "Event finance settings are invalid.";
                return false;
            }

            var options = new List<EventFinanceOption>();
            if (root.TryGetProperty("optionalActivities", out var optionArray))
            {
                if (optionArray.ValueKind != JsonValueKind.Array)
                {
                    error = "Optional activities must be a list.";
                    return false;
                }
                foreach (var item in optionArray.EnumerateArray())
                {
                    if (item.ValueKind != JsonValueKind.Object || !TryReadMoney(item, "extraFee", out var fee) || fee is null or < 0)
                    {
                        error = "Every optional activity must have a non-negative fee.";
                        return false;
                    }
                    options.Add(new EventFinanceOption(
                        ReadString(item, "id"),
                        ReadText(item, "name"),
                        fee.Value));
                }
            }

            if (!TryReadMoney(root, "baseFeePerAdult", out var adultFee)
                || !TryReadMoney(root, "baseFeePerChild", out var childFee)
                || adultFee < 0 || childFee < 0)
            {
                error = "Event fees must be non-negative numbers.";
                return false;
            }

            settings = new EventFinanceSettings(
                ReadString(root, "currency").Trim().ToUpperInvariant(),
                adultFee,
                childFee,
                ReadText(root, "paymentInstructions"),
                ReadText(root, "refundPolicy"),
                ReadBoolean(root, "paymentEvidenceRequired"),
                ReadBoolean(root, "financeLeaderConfirmed"),
                options);
            return true;
        }
        catch (JsonException)
        {
            error = "Event finance settings are invalid.";
            return false;
        }
    }

    public static EventModuleStatus ModuleStatus(GroupEvent groupEvent)
    {
        if (!TryReadSettings(groupEvent, out var settings, out _)) return EventModuleStatus.Blocked;
        if (!IsComplete(settings)) return EventModuleStatus.Configuring;
        return settings.LeaderConfirmed ? EventModuleStatus.Ready : EventModuleStatus.Configuring;
    }

    public static bool IsComplete(EventFinanceSettings settings)
        => !settings.HasCharges || (settings.Currency.Length == 3
            && settings.PaymentInstructions.IsComplete
            && settings.RefundPolicy.IsComplete
            && settings.Options.Where(x => x.ExtraFee > 0).All(x => x.Name.IsComplete));

    private static EventFinanceSettings Empty() => new(
        "NZD", null, null, new EventFinanceText(string.Empty, string.Empty),
        new EventFinanceText(string.Empty, string.Empty), false, false, []);

    private static bool TryReadMoney(JsonElement owner, string property, out decimal? value)
    {
        value = null;
        if (!owner.TryGetProperty(property, out var element) || element.ValueKind == JsonValueKind.Null) return true;
        if (element.ValueKind != JsonValueKind.Number || !element.TryGetDecimal(out var parsed)) return false;
        value = parsed;
        return true;
    }

    private static string ReadString(JsonElement owner, string property)
        => owner.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString() ?? string.Empty
            : string.Empty;

    private static EventFinanceText ReadText(JsonElement owner, string property)
    {
        if (!owner.TryGetProperty(property, out var value) || value.ValueKind != JsonValueKind.Object)
            return new EventFinanceText(string.Empty, string.Empty);
        return new EventFinanceText(ReadString(value, "en"), ReadString(value, "zh"));
    }

    private static bool ReadBoolean(JsonElement owner, string property)
        => owner.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.True;
}
