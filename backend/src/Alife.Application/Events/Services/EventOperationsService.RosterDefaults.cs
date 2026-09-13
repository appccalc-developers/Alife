using System.Text.Json;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Services;

public sealed partial class EventOperationsService
{
    public static EventRosterDefaults CreateRosterDefaults(IAlifeDbContext context, GroupEvent e, EventOccurrence source,
        IReadOnlyList<EventServiceSlot> slots, Guid actor, int version, DateTime now)
    {
        var sourceSlots = slots.Where(x => x.OccurrenceId == source.Id).OrderBy(x => x.StartUtc).ThenBy(x => x.RoleCode).ThenBy(x => x.Id).ToArray();
        var requirements = sourceSlots.Select(x => new EventRosterDefaultRequirement(x.RoleCode, x.RequiredCount,
            (int)(x.StartUtc - source.StartUtc).TotalMinutes, (int)(x.EndUtc - source.StartUtc).TotalMinutes, x.EligibilityCode)).ToArray();
        var defaults = new EventRosterDefaults { Id = Guid.NewGuid(), EventId = e.Id, Version = version, RequirementsJson = JsonSerializer.Serialize(requirements), CreatedByMemberId = actor, CreatedUtc = now };
        context.EventRosterDefaults.Add(defaults);
        for (var index = 0; index < sourceSlots.Length; index++) { sourceSlots[index].RosterDefaultsId = defaults.Id; sourceSlots[index].DefaultRequirementIndex = index; }
        return defaults;
    }

    public async Task<AppResult<EventRosterPageDto>> AdoptRosterDefaultsAsync(Guid eventId, Guid memberId, AdoptEventRosterDefaultsRequest request, CancellationToken ct)
    {
        await using var tx = await db.BeginSerializableTransactionAsync(ct);
        await db.LockEventRegistrationAsync(eventId, ct);
        var occurrence = await RosterQuery(eventId, request.OccurrenceId).FirstOrDefaultAsync(ct);
        if (occurrence is null) return AppResult<EventRosterPageDto>.NotFound("Occurrence not found.");
        if (!await CanCoordinate(occurrence.Event, memberId, "roster.coordinator", ct)) return AppResult<EventRosterPageDto>.Forbidden("Roster coordinator permission is required.");
        if (await EventPreparationPolicy.IsFrozenAsync(db, eventId, ct)) return AppResult<EventRosterPageDto>.Conflict(EventPreparationPolicy.FrozenMessage);
        if (!await IsModuleEnabled(eventId, "SERVICE.ROSTER", ct)) return AppResult<EventRosterPageDto>.Conflict("Roster is disabled.");
        var previous = await db.EventRosterDefaults.Where(x => x.EventId == eventId).OrderByDescending(x => x.Version).FirstOrDefaultAsync(ct);
        if (!Matches(request.OccurrenceETag, RosterETag(occurrence)) || request.DefaultsETag != DefaultsETag(previous)) return AppResult<EventRosterPageDto>.PreconditionFailed("The source date or defaults changed. Reload and review.");
        if (occurrence.ServiceSlots.Count == 0) return AppResult<EventRosterPageDto>.Validation("Define positions on this date before adopting its requirements.");
        CreateRosterDefaults(db, occurrence.Event, occurrence, occurrence.ServiceSlots.ToArray(), memberId, (previous?.Version ?? 0) + 1, DateTime.UtcNow);
        occurrence.RosterConcurrencyToken = Guid.NewGuid();
        if (packageInvalidation is not null) await packageInvalidation.InvalidateForModuleChangeAsync(occurrence.Event, memberId, "SERVICE.ROSTER", "event.roster.defaultsChanged", "operational", ct);
        await db.SaveChangesAsync(ct); if (tx is not null) await tx.CommitAsync(ct);
        return await GetRosterPageAsync(eventId, memberId, 1, ct);
    }

    public async Task<AppResult<EventRosterPageDto>> ExtendRosterAsync(Guid eventId, Guid memberId, string? defaultsETag, CancellationToken ct)
    {
        await using var tx = await db.BeginSerializableTransactionAsync(ct);
        await db.LockEventRegistrationAsync(eventId, ct);
        var e = await db.GroupEvents.Include(x => x.EventSeries).Include(x => x.Occurrences).FirstOrDefaultAsync(x => x.Id == eventId, ct);
        if (e is null) return AppResult<EventRosterPageDto>.NotFound("Event not found.");
        if (!await CanCoordinate(e, memberId, "roster.coordinator", ct)) return AppResult<EventRosterPageDto>.Forbidden("Roster coordinator permission is required.");
        if (!await IsModuleEnabled(eventId, "SERVICE.ROSTER", ct)) return AppResult<EventRosterPageDto>.Conflict("Roster is disabled.");
        var defaults = await db.EventRosterDefaults.AsNoTracking().Where(x => x.EventId == eventId).OrderByDescending(x => x.Version).FirstOrDefaultAsync(ct);
        if (defaults is null || e.EventSeries is null) return AppResult<EventRosterPageDto>.Conflict("Choose an occurrence to establish default positions for this recurring event first. / 请先选择一个场次，明确建立此重复活动的默认岗位。");
        if (DefaultsETag(defaults) != defaultsETag) return AppResult<EventRosterPageDto>.PreconditionFailed("Default positions changed. Reload first.");
        if (!await EventRosterPolicy.AllowsOrdinaryStaffingAsync(db, eventId, ct)) return AppResult<EventRosterPageDto>.Conflict(EventPreparationPolicy.FrozenMessage);
        var series = e.EventSeries;
        TimeZoneInfo zone;
        try { zone = TimeZoneInfo.FindSystemTimeZoneById(series.TimeZone); }
        catch (TimeZoneNotFoundException) { return AppResult<EventRosterPageDto>.Validation("The series time zone is unavailable."); }
        var anchor = series.FirstStartLocal ?? TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(e.StartDate, DateTimeKind.Utc), zone);
        var duration = series.DurationMinutes ?? (int)(e.Occurrences.OrderBy(x => x.StartUtc).FirstOrDefault() is { } first ? (first.EndUtc - first.StartUtc).TotalMinutes : (e.EndDate - e.StartDate).TotalMinutes);
        if (!EventSeriesMaterializer.TryValidate(series.RecurrenceRule, series.TimeZone, anchor, duration, 12, out var interval, out _, out var error)) return AppResult<EventRosterPageDto>.Validation(error!);
        var now = DateTime.UtcNow;
        var added = EventSeriesMaterializer.Materialize(eventId, anchor, duration, interval, 12, zone,
            (JsonSerializer.Deserialize<DateOnly[]>(series.ExceptionDatesJson) ?? []).ToHashSet(), e.Occurrences.Select(x => x.StartUtc).ToHashSet(), now);
        ApplyRosterDefaults(defaults, added, now);
        db.EventOccurrences.AddRange(added);
        await db.SaveChangesAsync(ct); if (tx is not null) await tx.CommitAsync(ct);
        return await GetRosterPageAsync(eventId, memberId, 1, ct);
    }

    public static void ApplyRosterDefaults(EventRosterDefaults defaults, IEnumerable<EventOccurrence> added, DateTime now)
    {
        var requirements = JsonSerializer.Deserialize<EventRosterDefaultRequirement[]>(defaults.RequirementsJson) ?? [];
        foreach (var occurrence in added)
        {
            occurrence.ServiceSlots = requirements.Select((x, index) => new EventServiceSlot { Id = Guid.NewGuid(), OccurrenceId = occurrence.Id,
                RosterDefaultsId = defaults.Id, DefaultRequirementIndex = index, RoleCode = x.RoleCode, RequiredCount = x.RequiredCount, EligibilityCode = x.EligibilityCode,
                StartUtc = occurrence.StartUtc.AddMinutes(x.StartOffsetMinutes), EndUtc = occurrence.StartUtc.AddMinutes(x.EndOffsetMinutes), CreatedUtc = now, UpdatedUtc = now }).ToList();
        }
    }
}
