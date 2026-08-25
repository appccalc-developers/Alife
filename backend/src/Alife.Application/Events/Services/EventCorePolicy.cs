using Alife.Domain.Entities;
using Alife.Domain.Enums;

namespace Alife.Application.Events.Services;

/// <summary>
/// Defines the minimum factual contract shared by every composed event.
/// Optional preparation belongs in dedicated modules rather than being folded into this check.
/// </summary>
public static class EventCorePolicy
{
    public static EventModuleStatus ModuleStatus(GroupEvent groupEvent)
    {
        if (string.IsNullOrWhiteSpace(groupEvent.TitleEn) && string.IsNullOrWhiteSpace(groupEvent.TitleZh))
            return EventModuleStatus.NotConfigured;

        if (groupEvent.StartDate == default || groupEvent.EndDate == default)
            return EventModuleStatus.NotConfigured;

        if (groupEvent.EndDate <= groupEvent.StartDate)
            return EventModuleStatus.Blocked;

        return EventVisibilityPolicy.TryReadVisibility(groupEvent.EventDataJson, out _)
            ? EventModuleStatus.Ready
            : EventModuleStatus.Blocked;
    }

    public static string? ValidationError(
        string titleEn,
        string titleZh,
        DateTime startDate,
        DateTime endDate,
        string eventDataJson)
    {
        if (string.IsNullOrWhiteSpace(titleEn) && string.IsNullOrWhiteSpace(titleZh))
            return "An event title is required in at least one language.";
        if (titleEn.Length > 300 || titleZh.Length > 300)
            return "Event titles cannot exceed 300 characters per language.";
        if (startDate == default || endDate == default)
            return "Event start and end times are required.";
        if (endDate <= startDate)
            return "Event end time must be after its start time.";
        if (!EventVisibilityPolicy.TryReadVisibility(eventDataJson, out _))
            return "Event data must be a JSON object with a supported visibility.";
        return null;
    }
}
