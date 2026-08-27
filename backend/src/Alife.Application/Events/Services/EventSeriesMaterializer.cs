using Alife.Domain.Entities;
using Alife.Domain.Enums;

namespace Alife.Application.Events.Services;

public static class EventSeriesMaterializer
{
    public static bool TryValidate(
        string recurrenceRule,
        string timeZone,
        DateTime firstStartLocal,
        int durationMinutes,
        int rollingOccurrenceWeeks,
        out int intervalWeeks,
        out TimeZoneInfo? timeZoneInfo,
        out string? error)
    {
        intervalWeeks = 1;
        timeZoneInfo = null;
        error = null;
        if (string.IsNullOrWhiteSpace(recurrenceRule))
        {
            error = "recurrenceRule is required.";
            return false;
        }
        if (string.IsNullOrWhiteSpace(timeZone))
        {
            error = "timeZone is required.";
            return false;
        }
        if (durationMinutes is < 1 or > 60 * 24 * 31)
        {
            error = "durationMinutes must be between 1 minute and 31 days.";
            return false;
        }
        if (rollingOccurrenceWeeks is < 1 or > 52)
        {
            error = "rollingOccurrenceWeeks must be between 1 and 52.";
            return false;
        }

        var rawParts = recurrenceRule
            .Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(part => part.Split('=', 2, StringSplitOptions.TrimEntries))
            .ToArray();
        if (rawParts.Any(part => part.Length != 2 || string.IsNullOrWhiteSpace(part[0]) || string.IsNullOrWhiteSpace(part[1])))
        {
            error = "recurrenceRule contains an invalid part.";
            return false;
        }
        var duplicate = rawParts
            .GroupBy(part => part[0].ToUpperInvariant(), StringComparer.Ordinal)
            .FirstOrDefault(group => group.Count() > 1);
        if (duplicate is not null)
        {
            error = $"recurrenceRule contains duplicate {duplicate.Key}.";
            return false;
        }
        var parts = rawParts.ToDictionary(
            part => part[0].ToUpperInvariant(),
            part => part[1].ToUpperInvariant(),
            StringComparer.Ordinal);
        var unsupported = parts.Keys.FirstOrDefault(key => key is not "FREQ" and not "INTERVAL" and not "BYDAY");
        if (unsupported is not null)
        {
            error = $"Unsupported recurrence rule part: {unsupported}.";
            return false;
        }
        if (!parts.TryGetValue("FREQ", out var frequency) || frequency != "WEEKLY")
        {
            error = "Only versioned weekly recurrence rules (FREQ=WEEKLY) are supported in this phase.";
            return false;
        }
        if (parts.TryGetValue("INTERVAL", out var rawInterval) &&
            (!int.TryParse(rawInterval, out intervalWeeks) || intervalWeeks is < 1 or > 52))
        {
            error = "The weekly recurrence INTERVAL must be between 1 and 52.";
            return false;
        }
        if (parts.TryGetValue("BYDAY", out var byDay))
        {
            var expectedDay = firstStartLocal.DayOfWeek switch
            {
                DayOfWeek.Monday => "MO",
                DayOfWeek.Tuesday => "TU",
                DayOfWeek.Wednesday => "WE",
                DayOfWeek.Thursday => "TH",
                DayOfWeek.Friday => "FR",
                DayOfWeek.Saturday => "SA",
                _ => "SU"
            };
            if (!string.Equals(byDay, expectedDay, StringComparison.Ordinal))
            {
                error = "BYDAY must contain the single weekday represented by firstStartLocal.";
                return false;
            }
        }

        try
        {
            timeZoneInfo = TimeZoneInfo.FindSystemTimeZoneById(timeZone.Trim());
        }
        catch (TimeZoneNotFoundException)
        {
            error = "timeZone must be a supported IANA time-zone identifier.";
            return false;
        }
        catch (InvalidTimeZoneException)
        {
            error = "timeZone is invalid.";
            return false;
        }

        var unspecified = DateTime.SpecifyKind(firstStartLocal, DateTimeKind.Unspecified);
        if (timeZoneInfo.IsInvalidTime(unspecified))
        {
            error = "firstStartLocal falls inside an invalid daylight-saving transition.";
            return false;
        }
        return true;
    }

    public static IReadOnlyList<EventOccurrence> Materialize(
        Guid eventId,
        DateTime firstStartLocal,
        int durationMinutes,
        int intervalWeeks,
        int rollingOccurrenceWeeks,
        TimeZoneInfo timeZone,
        IReadOnlySet<DateOnly> exceptionDates,
        IReadOnlySet<DateTime> existingStartUtc,
        DateTime nowUtc)
    {
        var nowLocal = TimeZoneInfo.ConvertTimeFromUtc(nowUtc, timeZone);
        var horizonLocal = nowLocal.Date.AddDays(rollingOccurrenceWeeks * 7);
        var candidate = DateTime.SpecifyKind(firstStartLocal, DateTimeKind.Unspecified);
        while (candidate.Date < nowLocal.Date)
        {
            candidate = candidate.AddDays(intervalWeeks * 7);
        }

        var occurrences = new List<EventOccurrence>();
        while (candidate.Date < horizonLocal)
        {
            var localDate = DateOnly.FromDateTime(candidate);
            if (!exceptionDates.Contains(localDate) && !timeZone.IsInvalidTime(candidate))
            {
                var startUtc = TimeZoneInfo.ConvertTimeToUtc(candidate, timeZone);
                if (!existingStartUtc.Contains(startUtc))
                {
                    occurrences.Add(new EventOccurrence
                    {
                        Id = Guid.NewGuid(),
                        EventId = eventId,
                        StartUtc = startUtc,
                        EndUtc = startUtc.AddMinutes(durationMinutes),
                        LocalDate = localDate,
                        Status = EventOccurrenceStatus.Scheduled,
                        CreatedUtc = nowUtc,
                        UpdatedUtc = nowUtc
                    });
                }
            }
            candidate = candidate.AddDays(intervalWeeks * 7);
        }
        return occurrences;
    }
}
