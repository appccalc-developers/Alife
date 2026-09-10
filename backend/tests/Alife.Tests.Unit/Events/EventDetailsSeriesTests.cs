using Alife.Application.Events.Services;

namespace Alife.Tests.Unit.Events;

public class EventDetailsSeriesTests
{
    [Fact]
    public void FortnightlyAucklandMeeting_PreservesWallClockAcrossDst_InTwelveWeekWindow()
    {
        var first = new DateTime(2026, 9, 19, 13, 30, 0);
        Assert.True(EventSeriesMaterializer.TryValidate(
            "FREQ=WEEKLY;INTERVAL=2;BYDAY=SA", "Pacific/Auckland", first, 60, 12,
            out var interval, out var zone, out var error), error);
        Assert.Equal(2, interval);
        var occurrences = EventSeriesMaterializer.Materialize(
            Guid.NewGuid(), first, 60, interval, 12, zone!, new HashSet<DateOnly>(),
            new HashSet<DateTime>(), new DateTime(2026, 9, 18, 0, 0, 0, DateTimeKind.Utc));
        Assert.Equal(6, occurrences.Count);
        Assert.Equal(new DateTime(2026, 9, 19, 1, 30, 0, DateTimeKind.Utc), occurrences[0].StartUtc);
        Assert.Equal(new DateTime(2026, 10, 3, 0, 30, 0, DateTimeKind.Utc), occurrences[1].StartUtc);
        Assert.All(occurrences, occurrence =>
        {
            var local = TimeZoneInfo.ConvertTimeFromUtc(occurrence.StartUtc, zone!);
            Assert.Equal(DayOfWeek.Saturday, local.DayOfWeek);
            Assert.Equal(new TimeSpan(13, 30, 0), local.TimeOfDay);
            Assert.Equal(TimeSpan.FromHours(1), occurrence.EndUtc - occurrence.StartUtc);
        });
    }
}
