using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Domain.Enums;

namespace Alife.Tests.Unit.Events;

public sealed class EventVisibilityPolicyTests
{
    [Fact]
    public void Explicit_publication_confirmation_is_independent_from_ram_approval()
    {
        var activity = Event("{\"visibility\":\"public\",\"publicationStatus\":\"published\"}", EventRamStatus.Draft);

        Assert.True(EventVisibilityPolicy.IsPublished(activity));
    }

    [Fact]
    public void Unconfirmed_draft_stays_private_but_legacy_ram_approval_remains_compatible()
    {
        Assert.False(EventVisibilityPolicy.IsPublished(Event("{\"visibility\":\"public\"}", EventRamStatus.Draft)));
        Assert.True(EventVisibilityPolicy.IsPublished(Event("{\"visibility\":\"public\"}", EventRamStatus.Approved)));
    }

    [Fact]
    public void Expanded_audience_sees_registration_but_not_internal_preparation_modules()
    {
        var source = Event("{\"visibility\":\"public\"}", EventRamStatus.Draft) with
        {
            EnabledModules = ["registration", "finance", "ram", "roster", "venue", "programme"]
        };

        var sanitized = EventVisibilityPolicy.SanitizeForExpandedAudience(source);

        Assert.Equal(["registration"], sanitized.EnabledModules);
        Assert.Equal(Guid.Empty, sanitized.CreatedByMemberId);
        Assert.Empty(sanitized.ContactProfileIds!);
    }

    private static GroupEventSummaryDto Event(string dataJson, EventRamStatus ramStatus)
        => new(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "Event", "活动",
            DateTime.UtcNow.AddDays(1), DateTime.UtcNow.AddDays(1).AddHours(2),
            dataJson, DateTime.UtcNow, DateTime.UtcNow, [], ramStatus, EventVisibilityPolicy.Public);
}
