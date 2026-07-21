using System.Globalization;
using System.Text.Json;
using Alife.Domain.Entities;

namespace Alife.Application.Events.Services;

public static class EventLifecyclePolicy
{
    public static bool CanCreateEnrollment(GroupEvent groupEvent, DateTime utcNow, out string error)
    {
        error = string.Empty;
        if (groupEvent.EndDate < utcNow)
        {
            error = "Enrollment is closed for this event.";
            return false;
        }

        try
        {
            using var document = JsonDocument.Parse(groupEvent.EventDataJson);
            var root = document.RootElement;
            var hasCapacity = root.TryGetProperty("maxCapacity", out var capacityElement) &&
                capacityElement.TryGetInt32(out var capacity) &&
                capacity > 0;
            var deadline = default(DateTimeOffset);
            var hasDeadline = root.TryGetProperty("registrationDeadline", out var deadlineElement) &&
                deadlineElement.ValueKind == JsonValueKind.String &&
                DateTimeOffset.TryParse(
                    deadlineElement.GetString(),
                    CultureInfo.InvariantCulture,
                    DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
                    out deadline);

            if (!hasCapacity || !hasDeadline)
            {
                error = "This event is not accepting enrollments.";
                return false;
            }

            if (deadline.UtcDateTime < utcNow)
            {
                error = "Enrollment is closed for this event.";
                return false;
            }

            return true;
        }
        catch (JsonException)
        {
            error = "This event is not accepting enrollments.";
            return false;
        }
    }

    public static bool CanCreateReview(GroupEvent groupEvent, DateTime utcNow)
        => groupEvent.EndDate < utcNow;
}
