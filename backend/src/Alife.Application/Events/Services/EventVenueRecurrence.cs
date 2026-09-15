using Alife.Application.Common.Interfaces;
using Alife.Domain.Entities;
using Microsoft.EntityFrameworkCore;
namespace Alife.Application.Events.Services;

public sealed record VenueRuleInterval(DateOnly LocalDate, DateTime StartUtc, DateTime EndUtc, bool InvalidLocalTime);
public static class EventVenueRecurrence
{
    public static bool HasInvalidWeeklyBoundary(EventVenueWeeklyBooking rule)
    {
        var zone = TimeZoneInfo.FindSystemTimeZoneById(rule.TimeZone);
        foreach (var adjustment in zone.GetAdjustmentRules().Where(x => x.DaylightDelta != TimeSpan.Zero))
        {
            var startYear = Math.Max(rule.FirstDate.Year, adjustment.DateStart.Year);
            var lastYear = Math.Min(rule.LastDate?.Year ?? 9997, Math.Min(adjustment.DateEnd.Year, 9997));
            // Gregorian dates and weekdays repeat every 400 years. Each adjustment rule has
            // fixed transition definitions, so no unbounded occurrence generation is needed.
            for (var year = startYear; year <= Math.Min(lastYear, startYear + 399); year++)
            {
                foreach (var transition in new[] { adjustment.DaylightTransitionStart, adjustment.DaylightTransitionEnd })
                {
                    var first = new DateOnly(year, transition.Month, 1);
                    var date = transition.IsFixedDateRule
                        ? new DateOnly(year, transition.Month, Math.Min(transition.Day, DateTime.DaysInMonth(year, transition.Month)))
                        : first.AddDays(((int)transition.DayOfWeek - (int)first.DayOfWeek + 7) % 7 + (transition.Week - 1) * 7);
                    if (date.Month != transition.Month) date = date.AddDays(-7);
                    if (date < DateOnly.FromDateTime(adjustment.DateStart) || date > DateOnly.FromDateTime(adjustment.DateEnd)) continue;
                    if (Expand(rule, date.AddDays(-1), date.AddDays(1)).Any(x => x.InvalidLocalTime)) return true;
                }
            }
        }
        return false;
    }
    public static bool Released(EventVenueWeeklyBooking rule, DateOnly date)
        => rule.Exceptions.Where(x => x.LocalDate == date).OrderByDescending(x => x.CreatedUtc).ThenByDescending(x => x.Id).FirstOrDefault()?.Released == true;
    public static bool Contains(EventVenueWeeklyBooking rule, DateOnly date) => date >= rule.FirstDate && (!rule.LastDate.HasValue || date <= rule.LastDate) && (date.DayNumber - rule.FirstDate.DayNumber) % 7 == 0;
    public static IEnumerable<VenueRuleInterval> Expand(EventVenueWeeklyBooking rule, DateOnly from, DateOnly until)
    {
        var zone = TimeZoneInfo.FindSystemTimeZoneById(rule.TimeZone);
        var first = from > rule.FirstDate ? from : rule.FirstDate;
        var remainder = (first.DayNumber - rule.FirstDate.DayNumber) % 7;
        if (remainder != 0) first = first.AddDays(7 - remainder);
        var last = rule.LastDate is { } end && end < until ? end : until;
        for (var date = first; date <= last; date = date.AddDays(7))
        {
            if (Released(rule, date)) continue;
            var start = date.ToDateTime(TimeOnly.MinValue).AddMinutes(rule.StartMinute);
            var finish = date.ToDateTime(TimeOnly.MinValue).AddMinutes(rule.EndMinute);
            var invalid = zone.IsInvalidTime(start) || zone.IsInvalidTime(finish) || zone.IsAmbiguousTime(start) || zone.IsAmbiguousTime(finish);
            // DST gaps/folds reserve a conservative interval and are shown for explicit correction.
            // They never make a standing reservation silently disappear.
            if (invalid) { start = date.ToDateTime(TimeOnly.MinValue); finish = date.AddDays(rule.EndMinute > 1440 ? 2 : 1).ToDateTime(TimeOnly.MinValue); }
            yield return new(date, ResolveBoundary(start, zone, true), ResolveBoundary(finish, zone, false), invalid);
        }
    }
    private static DateTime ResolveBoundary(DateTime local, TimeZoneInfo zone, bool lower)
    {
        while (zone.IsInvalidTime(local)) local = local.AddMinutes(lower ? -1 : 1);
        var offset = zone.IsAmbiguousTime(local)
            ? lower ? zone.GetAmbiguousTimeOffsets(local).Max() : zone.GetAmbiguousTimeOffsets(local).Min()
            : zone.GetUtcOffset(local);
        return DateTime.SpecifyKind(local - offset, DateTimeKind.Utc);
    }
    public static bool Overlaps(DateTime a, DateTime b, DateTime c, DateTime d) => a < d && c < b;
    public static bool Covers(EventVenueWeeklyBooking rule, DateTime start, DateTime end)
    {
        var zone = TimeZoneInfo.FindSystemTimeZoneById(rule.TimeZone);
        var from = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(start, zone)).AddDays(-2);
        var until = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(end, zone));
        return Expand(rule, from, until).Any(x => !x.InvalidLocalTime && x.StartUtc <= start && x.EndUtc >= end);
    }
    public static bool Conflicts(EventVenueWeeklyBooking rule, DateTime start, DateTime end)
    {
        var zone = TimeZoneInfo.FindSystemTimeZoneById(rule.TimeZone);
        var from = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(start, zone)).AddDays(-2);
        var until = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(end, zone));
        return Expand(rule, from, until).Any(x => Overlaps(x.StartUtc, x.EndUtc, start, end));
    }
    public static bool Conflicts(EventVenueWeeklyBooking a, EventVenueWeeklyBooking b)
    {
        // All rules for one venue use the same local time zone. The weekly pattern repeats;
        // only finitely many explicit exception dates can remove a matching pair.
        if (a.TimeZone != b.TimeZone) throw new InvalidOperationException("Venue recurrence time zones must match.");
        var from = a.FirstDate > b.FirstDate ? a.FirstDate : b.FirstDate;
        var until = from.AddDays(14 + 7 * (a.Exceptions.Count + b.Exceptions.Count));
        if (a.LastDate is { } endA && endA < until) until = endA.AddDays(1);
        if (b.LastDate is { } endB && endB < until) until = endB.AddDays(1);
        var left = Expand(a, from.AddDays(-2), until).ToArray(); var right = Expand(b, from.AddDays(-2), until).ToArray();
        return left.Any(x => right.Any(y => Overlaps(x.StartUtc, x.EndUtc, y.StartUtc, y.EndUtc)));
    }
    public static async Task<bool> ConflictsAsync(IAlifeDbContext db, Guid venue, DateTime start, DateTime end, CancellationToken ct)
    {
        var rules = await db.EventVenueWeeklyBookings.AsNoTracking().Include(x => x.Exceptions).Where(x => x.VenueId == venue).ToArrayAsync(ct);
        return rules.Any(x => Conflicts(x, start, end));
    }
}
