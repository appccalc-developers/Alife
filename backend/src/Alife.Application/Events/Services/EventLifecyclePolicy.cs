using Alife.Domain.Entities;
using Alife.Domain.Enums;

namespace Alife.Application.Events.Services;

public static class EventLifecyclePolicy
{
    public static bool CanCreateEnrollment(GroupEvent groupEvent, DateTime utcNow, out string error)
    {
        error = string.Empty;
        var ramRequired = groupEvent.Plan?.Modules.Any(x => x.IsRequired && x.ModuleKey == "ram")
            ?? EventCompositionFactory.RequiresRam(groupEvent.EventDataJson, groupEvent.RamAssessment?.RamDataJson);
        if (ramRequired && groupEvent.RamAssessment?.Status != EventRamStatus.Approved)
        {
            error = "This event is still in planning because its RAM has not been approved.";
            return false;
        }

        if (groupEvent.EndDate < utcNow)
        {
            error = "Enrollment is closed for this event.";
            return false;
        }

        return EventRegistrationPolicy.TryValidateConfiguration(groupEvent, utcNow, out _, out error);
    }

    public static bool CanCreateReview(GroupEvent groupEvent, DateTime utcNow)
        => groupEvent.EndDate < utcNow;
}
