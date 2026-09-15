using System.Text.Json;
using Alife.Application.Common.Interfaces;
using Alife.Application.Events.Dtos;
using Alife.Domain.Entities;
using Microsoft.EntityFrameworkCore;
namespace Alife.Application.Events.Services;

public static class EventPlanContextCapture
{
    public static async Task<RamEventPlanContextDto> CaptureAsync(IAlifeDbContext db, GroupEvent e, CancellationToken ct)
    {
        var snapshot = await db.EventPlanSnapshots.AsNoTracking().Where(x => x.EventId == e.Id && x.IsActive).OrderByDescending(x => x.Version).FirstOrDefaultAsync(ct);
        var plan = snapshot is null ? null : EventCompositionPersistence.ToSnapshotDto(snapshot);
        var enabled = plan?.Plan.ModuleDecisions.Where(x => x.Status != Alife.Domain.Enums.EventModuleDecisionStatus.Inactive).Select(x => x.ModuleCode).ToArray() ?? [];
        // Whitelist planning fields. Never copy embedded legacy RAM, enrollment payloads,
        // financial transactions, child records, conversations or upload locations.
        var names = new[] { "purpose", "description", "locationName", "timeZone", "hardConstraints", "optionalActivities", "registrationDeadline", "maxCapacity", "capacityUnit" };
        using var document = JsonDocument.Parse(e.EventDataJson);
        var details = document.RootElement.ValueKind == JsonValueKind.Object
            ? document.RootElement.EnumerateObject().Where(x => names.Contains(x.Name, StringComparer.Ordinal)).ToDictionary(x => x.Name, x => x.Value.Clone())
            : new Dictionary<string, JsonElement>();
        var reports = await db.EventModuleReportRevisions.AsNoTracking().Where(x => x.Report.EventId == e.Id &&
            x.Report.AdoptedRevisionId == x.Id && enabled.Contains(x.Report.ModuleCode)).OrderBy(x => x.Report.ModuleCode)
            .Select(x => new EventPlanReportDto(x.Report.ModuleCode, x.Id, x.Version, new(x.TextEn, x.TextZh))).ToArrayAsync(ct);
        var registration = await db.EventRegistrationPolicies.AsNoTracking().FirstOrDefaultAsync(x => x.EventId == e.Id, ct);
        var venues = await db.EventVenueReservations.AsNoTracking().Where(x => x.EventId == e.Id && x.Status == Alife.Domain.Enums.EventVenueReservationStatus.Confirmed)
            .OrderBy(x => x.StartUtc).ThenBy(x => x.Id).Select(x => new EventPlanVenueDto(new(x.Venue.NameEn, x.Venue.NameZh), x.StartUtc, x.EndUtc, x.RequiredCapacity)).ToArrayAsync(ct);
        var weekly = await db.EventVenueWeeklyBookings.AsNoTracking().Include(x => x.Venue).Include(x => x.Exceptions).Where(x => x.EventId == e.Id).OrderBy(x => x.FirstDate).ThenBy(x => x.Id).ToArrayAsync(ct);
        var defaults = await db.EventRosterDefaults.AsNoTracking().Where(x => x.EventId == e.Id).OrderByDescending(x => x.Version).FirstOrDefaultAsync(ct);
        var sessions = await db.EventSessions.AsNoTracking().Include(x => x.ProgramItems).Where(x => x.Occurrence.EventId == e.Id && x.Status != Alife.Domain.Enums.EventSessionStatus.Cancelled)
            .OrderBy(x => x.StartUtc).ThenBy(x => x.Id).ToArrayAsync(ct);
        return new(e.Id, e.GroupId, new(e.TitleEn, e.TitleZh), e.StartDate, e.EndDate, plan)
        {
            ActivityPlan = await EventActivityPlanService.ReadAsync(db,e.Id,ct),
            Details = JsonSerializer.SerializeToElement(details), Reports = reports,
            RegistrationRules = registration is null || !enabled.Contains("PEOPLE.REGISTRATION") ? null : EventRegistrationWorkService.Rules(registration), RegistrationRulesVersion = registration?.Version,
            Venues = venues,
            WeeklyVenues = weekly.Select(x => new EventPlanWeeklyVenueDto(new(x.Venue.NameEn,x.Venue.NameZh),x.FirstDate,x.LastDate,x.StartMinute,x.EndMinute,x.TimeZone,x.RequiredCapacity,
                x.Exceptions.Select(v => v.LocalDate).Distinct().Where(d => EventVenueRecurrence.Released(x,d)).Order().ToArray())).ToArray(),
            RosterNeeds = defaults is null ? [] : JsonSerializer.Deserialize<EventRosterDefaultRequirement[]>(defaults.RequirementsJson) ?? [],
            Programme = sessions.Select(s => new EventPlanSessionDto(new(s.TitleEn,s.TitleZh),s.StartUtc,s.EndUtc,
                s.ProgramItems.OrderBy(x => x.SortOrder).ThenBy(x => x.Id).Select(x => new EventPlanProgramItemDto(new(x.TitleEn,x.TitleZh),new(x.DescriptionEn,x.DescriptionZh),x.StartOffsetMinutes,x.DurationMinutes)).ToArray())).ToArray()
        };
    }
}
