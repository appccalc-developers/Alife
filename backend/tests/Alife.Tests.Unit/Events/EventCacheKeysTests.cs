using Alife.Application.Events.Services;

namespace Alife.Tests.Unit.Events;

public sealed class EventCacheKeysTests
{
    [Fact]
    public void EventDataEpoch_IsPartOfEveryBackendEventCacheKey()
    {
        var groupId = Guid.Parse("11111111-1111-1111-1111-111111111111");

        Assert.Equal(
            "event:1.1.0:data:reset-42:group:11111111-1111-1111-1111-111111111111:events",
            EventCacheKeys.GroupEvents(groupId, "reset-42"));
        Assert.Equal(
            "event:1.1.0:data:reset-42:public:upcoming",
            EventCacheKeys.PublicUpcomingEvents("reset-42"));
        Assert.NotEqual(
            EventCacheKeys.PublicUpcomingEvents("old-reset"),
            EventCacheKeys.PublicUpcomingEvents("reset-42"));
    }

    [Fact]
    public void ProductionCacheKeys_RejectMissingOrInvalidDataEpoch()
    {
        Assert.Throws<InvalidOperationException>(() =>
            EventCacheKeys.PublicUpcomingEvents(null, requireConfigured: true));
        Assert.Throws<InvalidOperationException>(() =>
            EventCacheKeys.PublicUpcomingEvents("contains spaces", requireConfigured: true));
    }
}
