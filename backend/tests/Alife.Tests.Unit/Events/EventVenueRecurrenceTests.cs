using Alife.Application.Events.Services;
using Alife.Domain.Entities;
using Xunit;

namespace Alife.Tests.Unit.Events;

public sealed class EventVenueRecurrenceTests
{
    private static EventVenueWeeklyBooking Weekly(int start = 540, int end = 720, string zone = "Pacific/Auckland")
        => new() { FirstDate = new(2026, 9, 20), StartMinute = start, EndMinute = end, TimeZone = zone };

    [Fact]
    public void IndefiniteSundayOccupiesNextYearWithoutGeneratedOccurrences()
    {
        var r = Weekly(); var date = new DateOnly(2027, 9, 19);
        var slot = Assert.Single(EventVenueRecurrence.Expand(r, date, date));
        Assert.True(EventVenueRecurrence.Conflicts(r, slot.StartUtc.AddMinutes(10), slot.EndUtc));
        Assert.True(EventVenueRecurrence.Covers(r, slot.StartUtc, slot.EndUtc));
        Assert.False(EventVenueRecurrence.Conflicts(r, slot.EndUtc, slot.EndUtc.AddHours(1)));
        r.Exceptions.Add(new() { Id = Guid.NewGuid(), LocalDate = date, Released = true, CreatedUtc = DateTime.UtcNow });
        Assert.False(EventVenueRecurrence.Conflicts(r, slot.StartUtc, slot.EndUtc));
        Assert.Single(EventVenueRecurrence.Expand(r, date.AddDays(7), date.AddDays(7)));
    }

    [Fact]
    public void WeeklyConflictsRemainAfterManyReleasedWeeksAndHandleOvernight()
    {
        var a = Weekly(1380, 1500, "Australia/Perth");
        var b = Weekly(30, 90, "Australia/Perth"); b.FirstDate = a.FirstDate.AddDays(1);
        for (var i = 0; i < 40; i++) a.Exceptions.Add(new() { Id = Guid.NewGuid(), LocalDate = a.FirstDate.AddDays(7 * i), Released = true, CreatedUtc = DateTime.UtcNow });
        Assert.True(EventVenueRecurrence.Conflicts(a, b));
        b.StartMinute = 60; b.EndMinute = 120;
        Assert.False(EventVenueRecurrence.Conflicts(a, b));
        b.StartMinute = 30; b.LastDate = a.FirstDate.AddDays(39 * 7 + 1);
        Assert.False(EventVenueRecurrence.Conflicts(a, b));
    }

    [Fact]
    public void LocalMorningKeepsNineOClockAcrossDaylightSaving()
    {
        var r = Weekly(); var slots = EventVenueRecurrence.Expand(r, r.FirstDate, r.FirstDate.AddDays(7)).ToArray();
        Assert.Equal(2, slots.Length);
        var zone = TimeZoneInfo.FindSystemTimeZoneById(r.TimeZone);
        Assert.All(slots, s => Assert.Equal(9, TimeZoneInfo.ConvertTimeFromUtc(s.StartUtc, zone).Hour));
        Assert.Equal(TimeSpan.FromDays(7) - TimeSpan.FromHours(1), slots[1].StartUtc - slots[0].StartUtc);
        Assert.False(EventVenueRecurrence.HasInvalidWeeklyBoundary(r));
        var gap = Weekly(150, 240);
        Assert.True(EventVenueRecurrence.HasInvalidWeeklyBoundary(gap));
        var gapSlot = Assert.Single(EventVenueRecurrence.Expand(gap, new(2026, 9, 27), new(2026, 9, 27)));
        Assert.True(gapSlot.InvalidLocalTime);
        Assert.True(gapSlot.EndUtc > gapSlot.StartUtc);
    }
}
