using Alife.Application.Events.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;

namespace Alife.Tests.Unit.Events;

public sealed class EventCorePolicyTests
{
    [Fact]
    public void Core_is_ready_only_when_identity_schedule_and_visibility_are_valid()
    {
        var groupEvent = Event("Community lunch", "", DateTime.UtcNow.AddDays(1), DateTime.UtcNow.AddDays(1).AddHours(2));

        Assert.Equal(EventModuleStatus.Ready, EventCorePolicy.ModuleStatus(groupEvent));

        groupEvent.TitleEn = "";
        Assert.Equal(EventModuleStatus.NotConfigured, EventCorePolicy.ModuleStatus(groupEvent));

        groupEvent.TitleZh = "社区午餐";
        groupEvent.EndDate = groupEvent.StartDate;
        Assert.Equal(EventModuleStatus.Blocked, EventCorePolicy.ModuleStatus(groupEvent));

        groupEvent.EndDate = groupEvent.StartDate.AddHours(2);
        groupEvent.EventDataJson = "{\"visibility\":\"secret\"}";
        Assert.Equal(EventModuleStatus.Blocked, EventCorePolicy.ModuleStatus(groupEvent));
    }

    [Fact]
    public void Core_validation_rejects_missing_title_and_invalid_schedule()
    {
        var start = DateTime.UtcNow.AddDays(1);

        Assert.NotNull(EventCorePolicy.ValidationError("", "", start, start.AddHours(1), "{}"));
        Assert.NotNull(EventCorePolicy.ValidationError("Event", "活动", start, start, "{}"));
        Assert.Null(EventCorePolicy.ValidationError("Event", "", start, start.AddHours(1), "{\"visibility\":\"groupVisible\"}"));
    }

    private static GroupEvent Event(string titleEn, string titleZh, DateTime start, DateTime end) => new()
    {
        TitleEn = titleEn,
        TitleZh = titleZh,
        StartDate = start,
        EndDate = end,
        EventDataJson = "{\"visibility\":\"groupVisible\"}"
    };
}
