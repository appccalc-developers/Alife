using System.Globalization;
using System.Text.Json;
using Alife.Domain.Entities;

namespace Alife.Application.Events.Services;

public sealed record EventRegistrationSettings(
    int MaxCapacity,
    string CapacityUnit,
    DateTimeOffset? RegistrationDeadlineUtc)
{
    public bool IsConfigured => MaxCapacity > 0 && RegistrationDeadlineUtc.HasValue;
}

public static class EventRegistrationPolicy
{
    public const string People = "People";
    public const string Families = "Families";

    public static bool IsEnabled(GroupEvent groupEvent)
        => EventCompositionFactory.UsesOptionalModule(groupEvent.EventDataJson, "registration");

    public static bool TryReadSettings(GroupEvent groupEvent, out EventRegistrationSettings settings, out string error)
    {
        settings = new EventRegistrationSettings(0, People, null);
        error = string.Empty;
        try
        {
            using var document = JsonDocument.Parse(groupEvent.EventDataJson);
            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
            {
                error = "Event registration settings are invalid.";
                return false;
            }

            var maxCapacity = root.TryGetProperty("maxCapacity", out var capacityElement)
                && capacityElement.TryGetInt32(out var parsedCapacity)
                ? parsedCapacity
                : 0;
            var capacityUnit = root.TryGetProperty("capacityUnit", out var unitElement)
                && unitElement.ValueKind == JsonValueKind.String
                && string.Equals(unitElement.GetString(), Families, StringComparison.OrdinalIgnoreCase)
                    ? Families
                    : People;
            DateTimeOffset? deadline = null;
            if (root.TryGetProperty("registrationDeadline", out var deadlineElement)
                && deadlineElement.ValueKind == JsonValueKind.String
                && DateTimeOffset.TryParse(
                    deadlineElement.GetString(),
                    CultureInfo.InvariantCulture,
                    DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
                    out var parsedDeadline))
            {
                deadline = parsedDeadline;
            }

            settings = new EventRegistrationSettings(maxCapacity, capacityUnit, deadline);
            return true;
        }
        catch (JsonException)
        {
            error = "Event registration settings are invalid.";
            return false;
        }
    }

    public static bool TryValidateConfiguration(
        GroupEvent groupEvent,
        DateTime utcNow,
        out EventRegistrationSettings settings,
        out string error)
    {
        if (!TryReadSettings(groupEvent, out settings, out error)) return false;
        if (!settings.IsConfigured)
        {
            error = "This event is not accepting enrollments.";
            return false;
        }
        if (settings.RegistrationDeadlineUtc!.Value.UtcDateTime > groupEvent.StartDate)
        {
            error = "The registration deadline must be before the event starts.";
            return false;
        }
        if (settings.RegistrationDeadlineUtc.Value.UtcDateTime < utcNow || groupEvent.EndDate < utcNow)
        {
            error = "Enrollment is closed for this event.";
            return false;
        }
        return true;
    }

    public static bool TryReadReservedUnits(string enrollmentJson, string capacityUnit, out int units, out string error)
    {
        units = 1;
        error = string.Empty;
        if (capacityUnit == Families) return true;

        try
        {
            using var document = JsonDocument.Parse(enrollmentJson);
            if (document.RootElement.ValueKind != JsonValueKind.Object)
            {
                error = "Enrollment details must be a JSON object.";
                return false;
            }
            if (!document.RootElement.TryGetProperty("participantCount", out var countElement)) return true;
            if (!countElement.TryGetInt32(out units) || units <= 0)
            {
                error = "Participant count must be a positive whole number.";
                return false;
            }
            return true;
        }
        catch (JsonException)
        {
            error = "Enrollment details are invalid.";
            return false;
        }
    }

    public static bool ValidateEnrollmentRequirements(GroupEvent groupEvent, string enrollmentJson, out string error)
    {
        error = string.Empty;
        try
        {
            using var eventDocument = JsonDocument.Parse(groupEvent.EventDataJson);
            var evidenceRequired = eventDocument.RootElement.TryGetProperty("paymentEvidenceRequired", out var required)
                && required.ValueKind == JsonValueKind.True;
            if (!evidenceRequired) return true;

            using var enrollmentDocument = JsonDocument.Parse(enrollmentJson);
            if (enrollmentDocument.RootElement.ValueKind == JsonValueKind.Object
                && enrollmentDocument.RootElement.TryGetProperty("paymentFiles", out var files)
                && files.ValueKind == JsonValueKind.Array
                && files.GetArrayLength() > 0)
                return true;
            error = "Payment evidence is required for this event registration.";
            return false;
        }
        catch (JsonException)
        {
            error = "Enrollment details are invalid.";
            return false;
        }
    }

    public static int CountReservedUnits(IEnumerable<string> enrollmentJson, string capacityUnit)
        => enrollmentJson.Sum(json => TryReadReservedUnits(json, capacityUnit, out var units, out _) ? units : 1);
}
