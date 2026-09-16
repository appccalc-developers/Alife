using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;
namespace Alife.Application.Events.Services;

public sealed record WeeklyVenueRequest(Guid EventId, DateOnly FirstDate, DateOnly? LastDate, int StartMinute, int EndMinute,
    int RequiredCapacity, Guid? ReplacesRuleId = null, string Reason = "");
public sealed record VenueExceptionRequest(DateOnly LocalDate, bool Released, string Reason);
public sealed record VenueCalendarEntry(Guid BookingId, Guid? EventId, LocalizedTextDto Title, DateTime StartUtc, DateTime EndUtc,
    DateOnly? LocalDate, bool Weekly, bool Released, bool InvalidLocalTime, bool CanManage, string ETag);
public sealed record WeeklyVenueDto(Guid Id, Guid? EventId, DateOnly FirstDate, DateOnly? LastDate, int StartMinute, int EndMinute,
    string TimeZone, int RequiredCapacity, bool CanManage, string ETag);
public sealed record VenueBookingHistoryDto(Guid RuleId, DateOnly LocalDate, string Action, string Reason, Guid ActorMemberId, DateTime CreatedUtc);
public sealed record VenueCalendarDto(Guid VenueId, string TimeZone, IReadOnlyList<VenueCalendarEntry> Entries, IReadOnlyList<WeeklyVenueDto> Rules,
    IReadOnlyList<VenueBookingHistoryDto> History);

public sealed class EventVenueCalendarService(IAlifeDbContext db, IGroupAuthorizationService authorization, IEventPackageInvalidationService invalidation)
{
    public static string ETag(EventVenueWeeklyBooking r) => $"\"weekly-{r.ConcurrencyToken:N}\"";
    private async Task<bool> Manage(EventVenue v, GroupEvent e, Guid actor, CancellationToken ct)
        => await EventVenueScope.CanReserveAsync(db, e.GroupId, v.ManagingGroupId, ct) &&
           (await authorization.IsLeaderOrCoLeaderAsync(v.ManagingGroupId, actor, ct) ||
            await authorization.IsLeaderOrCoLeaderAsync(e.GroupId, actor, ct) ||
            await EventWorkAccess.OwnerAsync(db, e, actor, ct));
    private async Task<bool> ViewEvent(GroupEvent e, Guid actor, CancellationToken ct)
    {
        if (await EventWorkAccess.PlanReaderAsync(db, e, actor, ct)) return true;
        if (e.PublicationStatus is not (EventPublicationStatus.Published or EventPublicationStatus.LegacyImplicit)) return false;
        var scope = EventVisibilityPolicy.ReadVisibility(e.EventDataJson);
        if (scope == "public" || await EventWorkAccess.MemberAsync(db, e.GroupId, actor, ct)) return true;
        var root = await EventCompositionPersistence.FindChurchRootIdAsync(db, e.GroupId, ct);
        return scope == "churchVisible" && root.HasValue && await EventWorkAccess.MemberAsync(db, root.Value, actor, ct);
    }
    public async Task<AppResult<VenueCalendarDto>> CalendarAsync(Guid group, Guid venueId, Guid actor, DateOnly from, DateOnly until, CancellationToken ct)
    {
        if (until < from || until.DayNumber - from.DayNumber > 366 || from.Year < 2 || until.Year > 9997)
            return AppResult<VenueCalendarDto>.Validation("Choose a calendar range of at most 366 days.");
        if (!await EventWorkAccess.MemberAsync(db, group, actor, ct)) return AppResult<VenueCalendarDto>.Forbidden("Current group membership is required.");
        var managingGroupIds = await EventVenueScope.ReservableManagingGroupIdsAsync(db, group, ct);
        var venue = await db.EventVenues.AsNoTracking().FirstOrDefaultAsync(x => x.Id == venueId && managingGroupIds.Contains(x.ManagingGroupId), ct);
        if (venue is null) return AppResult<VenueCalendarDto>.NotFound("Venue not found.");
        var zone = TimeZoneInfo.FindSystemTimeZoneById(venue.TimeZone);
        // UTC envelope intentionally includes both possible offsets on transition dates.
        var lower = from.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc).AddDays(-2);
        var upper = until.AddDays(2).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var singles = await db.EventVenueReservations.AsNoTracking().Include(x => x.Event).Where(x => x.VenueId == venueId &&
            x.Status == EventVenueReservationStatus.Confirmed && x.StartUtc < upper && x.EndUtc > lower).ToArrayAsync(ct);
        var rules = await db.EventVenueWeeklyBookings.AsNoTracking().Include(x => x.Event).Include(x => x.Exceptions)
            .Where(x => x.VenueId == venueId && x.FirstDate <= until && (x.LastDate == null || x.LastDate >= from.AddDays(-1))).ToArrayAsync(ct);
        var entries = new List<VenueCalendarEntry>(); var projected = new List<WeeklyVenueDto>(); var history = new List<VenueBookingHistoryDto>();
        foreach (var s in singles)
        {
            if (DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(s.StartUtc, zone)) > until || DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(s.EndUtc, zone)) < from) continue;
            var visible = await ViewEvent(s.Event, actor, ct);
            entries.Add(new(s.Id, visible ? s.EventId : null, visible ? new(s.Event.TitleEn, s.Event.TitleZh) : new("Occupied", "已占用"),
                s.StartUtc, s.EndUtc, null, false, false, false, false, ""));
        }
        foreach (var r in rules)
        {
            var visible = await ViewEvent(r.Event, actor, ct); var manage = await Manage(venue, r.Event, actor, ct);
            var label = visible ? new LocalizedTextDto(r.Event.TitleEn, r.Event.TitleZh) : new("Occupied", "已占用");
            projected.Add(new(r.Id, visible || manage ? r.EventId : null, r.FirstDate, r.LastDate, r.StartMinute, r.EndMinute, r.TimeZone, r.RequiredCapacity, manage, manage ? ETag(r) : ""));
            if (manage)
            {
                history.Add(new(r.Id, r.FirstDate, r.ReplacesRuleId.HasValue ? "change-future" : "create", r.ChangeReason, r.CreatedByMemberId, r.CreatedUtc));
                history.AddRange(r.Exceptions.Where(x => x.LocalDate >= from && x.LocalDate <= until)
                    .Select(x => new VenueBookingHistoryDto(r.Id, x.LocalDate, x.Released ? "release" : "restore", x.Reason, x.ActorMemberId, x.CreatedUtc)));
            }
            foreach (var i in EventVenueRecurrence.Expand(r, from.AddDays(-1), until))
                entries.Add(new(r.Id, visible ? r.EventId : null, label, i.StartUtc, i.EndUtc, i.LocalDate, true, false, i.InvalidLocalTime, manage, manage ? ETag(r) : ""));
            // Released entries and reasons are management data, not public availability records.
            if (manage)
                foreach (var date in r.Exceptions.Select(x => x.LocalDate).Distinct().Where(d => d >= from && d <= until && EventVenueRecurrence.Contains(r, d) && EventVenueRecurrence.Released(r, d)))
                {
                    var copy = new EventVenueWeeklyBooking { FirstDate = date, LastDate = date, StartMinute = r.StartMinute, EndMinute = r.EndMinute, TimeZone = r.TimeZone };
                    var interval = EventVenueRecurrence.Expand(copy, date, date).Single();
                    entries.Add(new(r.Id, visible ? r.EventId : null, label, interval.StartUtc, interval.EndUtc, date, true, true, interval.InvalidLocalTime, true, ETag(r)));
                }
        }
        return AppResult<VenueCalendarDto>.Success(new(venueId, venue.TimeZone, entries.OrderBy(x => x.StartUtc).ToArray(), projected, history.OrderByDescending(x => x.CreatedUtc).ToArray()));
    }
    public async Task<AppResult<Guid>> SaveWeeklyAsync(Guid group, Guid venueId, Guid actor, WeeklyVenueRequest request, string? expected, string? key, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(key) || key.Length > 180 || request.FirstDate.Year is < 2 or > 9997 || request.LastDate < request.FirstDate || request.LastDate?.Year > 9997 ||
            request.StartMinute is < 0 or >= 1440 || request.EndMinute <= request.StartMinute || request.EndMinute > request.StartMinute + 1440 || request.RequiredCapacity < 1 || request.Reason.Length > 2000)
            return AppResult<Guid>.Validation("A valid weekly interval, capacity and Idempotency-Key are required.");
        await using var tx = await db.BeginSerializableTransactionAsync(ct);
        await db.LockEventRegistrationAsync(request.EventId, ct); await db.LockEventVenueAsync(venueId, ct);
        var managingGroupIds = await EventVenueScope.ReservableManagingGroupIdsAsync(db, group, ct);
        var venue = await db.EventVenues.FirstOrDefaultAsync(x => x.Id == venueId && managingGroupIds.Contains(x.ManagingGroupId), ct);
        var e = await db.GroupEvents.FirstOrDefaultAsync(x => x.Id == request.EventId && x.GroupId == group, ct);
        if (venue is null || e is null) return AppResult<Guid>.NotFound("Venue or event not found.");
        if (!await Manage(venue, e, actor, ct)) return AppResult<Guid>.Forbidden("The event owner or venue administrator must manage standing reservations.");
        if (!await EventWorkAccess.EnabledAsync(db, e.Id, "PLACE.RESOURCE", ct)) return AppResult<Guid>.Conflict("Enable venue requirements in the event plan first.");
        var hash = EventCompositionEngine.Hash(new { actor, request });
        var replay = await db.EventIdempotencyRecords.AsNoTracking().FirstOrDefaultAsync(x => x.Operation == "venue.weekly" && x.ScopeId == venueId && x.Key == key, ct);
        if (replay is not null) return replay.RequestHash == hash ? AppResult<Guid>.Success(replay.ResultEntityId) : AppResult<Guid>.Conflict("Idempotency-Key already used.");
        if (!venue.IsActive || venue.Capacity < request.RequiredCapacity) return AppResult<Guid>.Conflict("The venue is inactive or has insufficient capacity.");
        var rules = await db.EventVenueWeeklyBookings.Include(x => x.Exceptions).Where(x => x.VenueId == venueId).ToArrayAsync(ct);
        EventVenueWeeklyBooking? previous = null;
        DateOnly? previousLastDate = null;
        if (request.ReplacesRuleId is { } previousId)
        {
            previous = rules.FirstOrDefault(x => x.Id == previousId && x.EventId == e.Id);
            if (previous is null) return AppResult<Guid>.NotFound("Previous rule not found.");
            if (expected != ETag(previous)) return AppResult<Guid>.PreconditionFailed("Reload the changed standing reservation.");
            var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, TimeZoneInfo.FindSystemTimeZoneById(venue.TimeZone)));
            if (request.FirstDate <= previous.FirstDate || request.FirstDate < today || string.IsNullOrWhiteSpace(request.Reason))
                return AppResult<Guid>.Validation("A future effective date after the original start and a reason are required.");
            previousLastDate = previous.LastDate;
        }
        else if (expected != $"\"venue-{venue.ConcurrencyToken:N}\"") return AppResult<Guid>.PreconditionFailed("Reload the changed venue calendar.");
        var r = new EventVenueWeeklyBooking { Id = Guid.NewGuid(), VenueId = venueId, EventId = e.Id, FirstDate = request.FirstDate,
            LastDate = request.LastDate, StartMinute = request.StartMinute, EndMinute = request.EndMinute, TimeZone = venue.TimeZone,
            RequiredCapacity = request.RequiredCapacity, ReplacesRuleId = previous?.Id, PreviousLastDate = previousLastDate, ChangeReason = request.Reason.Trim(), CreatedByMemberId = actor, CreatedUtc = DateTime.UtcNow };
        if (EventVenueRecurrence.HasInvalidWeeklyBoundary(r)) return AppResult<Guid>.Validation("A weekly boundary falls in a daylight-saving gap or repeated hour. Choose an unambiguous local time or use separately reviewed single reservations for those dates.");
        if (rules.Any(other => EventVenueRecurrence.Conflicts(r, other == previous
            ? new EventVenueWeeklyBooking { FirstDate = other.FirstDate, LastDate = request.FirstDate.AddDays(-1), StartMinute = other.StartMinute, EndMinute = other.EndMinute, TimeZone = other.TimeZone, Exceptions = other.Exceptions }
            : other))) return AppResult<Guid>.Conflict("The weekly interval conflicts with another standing reservation.");
        var singles = await db.EventVenueReservations.AsNoTracking().Where(x => x.VenueId == venueId && x.Status == EventVenueReservationStatus.Confirmed).ToArrayAsync(ct);
        if (singles.Any(s => EventVenueRecurrence.Conflicts(r, s.StartUtc, s.EndUtc))) return AppResult<Guid>.Conflict("The weekly interval conflicts with an existing single reservation.");
        if (previous is not null) { previous.LastDate = request.FirstDate.AddDays(-1); previous.ConcurrencyToken = Guid.NewGuid(); }
        db.EventVenueWeeklyBookings.Add(r); venue.ConcurrencyToken = Guid.NewGuid(); venue.UpdatedUtc = DateTime.UtcNow;
        db.EventIdempotencyRecords.Add(new() { Id = Guid.NewGuid(), Operation = "venue.weekly", ScopeId = venueId, Key = key, RequestHash = hash, ResultEntityId = r.Id, CreatedUtc = DateTime.UtcNow, ExpiresUtc = DateTime.UtcNow.AddDays(1) });
        await invalidation.InvalidateForModuleChangeAsync(e, actor, "PLACE.RESOURCE", "event.venue.weeklyChanged", "governanceCritical", ct);
        await db.SaveChangesAsync(ct); if (tx is not null) await tx.CommitAsync(ct);
        return AppResult<Guid>.Success(r.Id);
    }
    public async Task<AppResult<Guid>> ExceptionAsync(Guid group, Guid venueId, Guid ruleId, Guid actor, VenueExceptionRequest request, string? expected, string? key, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Reason) || request.Reason.Length > 2000 || string.IsNullOrWhiteSpace(key) || key.Length > 180)
            return AppResult<Guid>.Validation("A reason and Idempotency-Key are required.");
        var eventId = await db.EventVenueWeeklyBookings.AsNoTracking().Where(x => x.Id == ruleId && x.VenueId == venueId).Select(x => (Guid?)x.EventId).FirstOrDefaultAsync(ct);
        if (!eventId.HasValue) return AppResult<Guid>.NotFound("Standing reservation not found.");
        await using var tx = await db.BeginSerializableTransactionAsync(ct); await db.LockEventRegistrationAsync(eventId.Value, ct); await db.LockEventVenueAsync(venueId, ct);
        var r = await db.EventVenueWeeklyBookings.Include(x => x.Exceptions).Include(x => x.Event).Include(x => x.Venue).FirstAsync(x => x.Id == ruleId, ct);
        var routeMatchesEventOrVenue = r.Event.GroupId == group || r.Venue.ManagingGroupId == group;
        if (!routeMatchesEventOrVenue || !await EventVenueScope.CanReserveAsync(db, r.Event.GroupId, r.Venue.ManagingGroupId, ct) ||
            !await Manage(r.Venue, r.Event, actor, ct)) return AppResult<Guid>.Forbidden("The event owner or venue administrator is required.");
        var hash = EventCompositionEngine.Hash(new { actor, request, ruleId });
        var replay = await db.EventIdempotencyRecords.AsNoTracking().FirstOrDefaultAsync(x => x.Operation == "venue.exception" && x.ScopeId == venueId && x.Key == key, ct);
        if (replay is not null) return replay.RequestHash == hash ? AppResult<Guid>.Success(replay.ResultEntityId) : AppResult<Guid>.Conflict("Idempotency-Key already used.");
        if (expected != ETag(r)) return AppResult<Guid>.PreconditionFailed("Reload the changed standing reservation.");
        if (!EventVenueRecurrence.Contains(r, request.LocalDate)) return AppResult<Guid>.Validation("This date is not part of the standing reservation.");
        if (EventVenueRecurrence.Released(r, request.LocalDate) == request.Released) return AppResult<Guid>.Conflict("This occurrence is already in the requested state.");
        if (!request.Released)
        {
            var single = new EventVenueWeeklyBooking { FirstDate = request.LocalDate, LastDate = request.LocalDate, StartMinute = r.StartMinute, EndMinute = r.EndMinute, TimeZone = r.TimeZone };
            var interval = EventVenueRecurrence.Expand(single, request.LocalDate, request.LocalDate).Single();
            var others = await db.EventVenueWeeklyBookings.AsNoTracking().Include(x => x.Exceptions).Where(x => x.VenueId == venueId && x.Id != ruleId).ToArrayAsync(ct);
            if (others.Any(other => EventVenueRecurrence.Conflicts(other, interval.StartUtc, interval.EndUtc)) ||
                await db.EventVenueReservations.AnyAsync(x => x.VenueId == venueId && x.Status == EventVenueReservationStatus.Confirmed && x.StartUtc < interval.EndUtc && x.EndUtc > interval.StartUtc, ct))
                return AppResult<Guid>.Conflict("Another reservation now occupies this interval; restoration cannot overwrite it.");
        }
        var action = new EventVenueBookingException { Id = Guid.NewGuid(), WeeklyBookingId = ruleId, LocalDate = request.LocalDate, Released = request.Released, Reason = request.Reason.Trim(), ActorMemberId = actor, CreatedUtc = DateTime.UtcNow };
        db.EventVenueBookingExceptions.Add(action); r.ConcurrencyToken = Guid.NewGuid(); r.Venue.ConcurrencyToken = Guid.NewGuid(); r.Venue.UpdatedUtc = DateTime.UtcNow;
        db.EventIdempotencyRecords.Add(new() { Id = Guid.NewGuid(), Operation = "venue.exception", ScopeId = venueId, Key = key, RequestHash = hash, ResultEntityId = action.Id, CreatedUtc = DateTime.UtcNow, ExpiresUtc = DateTime.UtcNow.AddDays(1) });
        await invalidation.InvalidateForModuleChangeAsync(r.Event, actor, "PLACE.RESOURCE", "event.venue.exceptionChanged", "governanceCritical", ct);
        await db.SaveChangesAsync(ct); if (tx is not null) await tx.CommitAsync(ct);
        return AppResult<Guid>.Success(action.Id);
    }
}
