using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Services;

public sealed class EventVenueService(
    IAlifeDbContext db,
    IGroupAuthorizationService authorization) : IEventVenueService
{
    private const string ModuleCode = "PLACE.RESOURCE";
    private const string CoordinatorRoleKey = "PLACE.RESOURCE:resource.coordinator";
    private const string CreateVenueOperation = "venue.create";
    private const string ReserveOperation = "venue.reserve";
    private const string ReleaseOperation = "venue.release";

    public async Task<AppResult<EventVenueCatalogueDto>> ListCatalogueAsync(Guid groupId, Guid memberId, CancellationToken ct)
    {
        if (!await db.Groups.AsNoTracking().AnyAsync(x => x.Id == groupId, ct))
            return AppResult<EventVenueCatalogueDto>.NotFound("Group not found.");
        var canManage = await CanManageCatalogue(groupId, memberId, ct);
        if (!canManage && !await authorization.IsApprovedMemberAsync(groupId, memberId, ct))
            return AppResult<EventVenueCatalogueDto>.Forbidden("Approved group membership or resource coordinator access is required.");
        var venues = await db.EventVenues.AsNoTracking().Where(x => x.ManagingGroupId == groupId)
            .OrderByDescending(x => x.IsActive).ThenBy(x => x.NameEn).ToListAsync(ct);
        return AppResult<EventVenueCatalogueDto>.Success(new(groupId, venues.Select(ToVenueDto).ToArray(), canManage));
    }

    public async Task<AppResult<EventVenueDto>> CreateVenueAsync(Guid groupId, Guid memberId, SaveEventVenueRequest request, string? idempotencyKey, CancellationToken ct)
    {
        if (!await db.Groups.AsNoTracking().AnyAsync(x => x.Id == groupId, ct))
            return AppResult<EventVenueDto>.NotFound("Group not found.");
        if (!await CanManageCatalogue(groupId, memberId, ct))
            return AppResult<EventVenueDto>.Forbidden("Group leadership or accepted resource coordinator access is required.");
        var validation = ValidateVenue(request);
        if (validation is not null) return AppResult<EventVenueDto>.Validation(validation);
        var keyError = ValidateIdempotencyKey(idempotencyKey);
        if (keyError is not null) return AppResult<EventVenueDto>.Validation(keyError);
        var normalizedKey = idempotencyKey!.Trim();
        var requestHash = EventCompositionEngine.Hash(new { groupId, memberId, request });
        var retry = await FindIdempotent(CreateVenueOperation, groupId, normalizedKey, requestHash, ct);
        if (!retry.IsSuccess) return ConvertFailure<EventVenueDto, EventIdempotencyRecord?>(retry);
        if (retry.Value is not null)
        {
            var previous = await db.EventVenues.AsNoTracking().FirstOrDefaultAsync(x => x.Id == retry.Value.ResultEntityId, ct);
            return previous is null
                ? AppResult<EventVenueDto>.Conflict("The idempotent venue result is no longer available.")
                : AppResult<EventVenueDto>.Success(ToVenueDto(previous));
        }

        var now = DateTime.UtcNow;
        var venue = new EventVenue
        {
            Id = Guid.NewGuid(), ManagingGroupId = groupId,
            NameEn = request.Name.En.Trim(), NameZh = request.Name.Zh.Trim(),
            AddressEn = request.Address?.En.Trim() ?? string.Empty, AddressZh = request.Address?.Zh.Trim() ?? string.Empty,
            Capacity = request.Capacity, IsActive = request.IsActive, CreatedByMemberId = memberId,
            CreatedUtc = now, UpdatedUtc = now
        };
        db.EventVenues.Add(venue);
        db.EventIdempotencyRecords.Add(NewIdempotency(CreateVenueOperation, groupId, normalizedKey, requestHash, venue.Id, now));
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException) { return AppResult<EventVenueDto>.Conflict("The venue or idempotency key was created by another request; reload and try again."); }
        return AppResult<EventVenueDto>.Success(ToVenueDto(venue));
    }

    public async Task<AppResult<EventVenueDto>> UpdateVenueAsync(Guid groupId, Guid venueId, Guid memberId, SaveEventVenueRequest request, string? ifMatch, CancellationToken ct)
    {
        var venue = await db.EventVenues.FirstOrDefaultAsync(x => x.Id == venueId && x.ManagingGroupId == groupId, ct);
        if (venue is null) return AppResult<EventVenueDto>.NotFound("Venue not found.");
        if (!await CanManageCatalogue(groupId, memberId, ct))
            return AppResult<EventVenueDto>.Forbidden("Group leadership or accepted resource coordinator access is required.");
        if (!Matches(ifMatch, VenueETag(venue)))
            return AppResult<EventVenueDto>.PreconditionFailed("The venue changed; reload before saving.");
        var validation = ValidateVenue(request);
        if (validation is not null) return AppResult<EventVenueDto>.Validation(validation);
        var activeReservation = await db.EventVenueReservations.AsNoTracking()
            .Where(x => x.VenueId == venue.Id && x.Status == EventVenueReservationStatus.Confirmed)
            .OrderBy(x => x.StartUtc).FirstOrDefaultAsync(x => x.RequiredCapacity > request.Capacity || !request.IsActive, ct);
        if (activeReservation is not null)
        {
            var action = !request.IsActive ? "deactivate" : "reduce capacity for";
            return AppResult<EventVenueDto>.Conflict($"Cannot {action} venue {venue.NameEn}; confirmed reservation {FormatInterval(activeReservation.StartUtc, activeReservation.EndUtc)} requires capacity {activeReservation.RequiredCapacity}.");
        }
        venue.NameEn = request.Name.En.Trim(); venue.NameZh = request.Name.Zh.Trim();
        venue.AddressEn = request.Address?.En.Trim() ?? string.Empty; venue.AddressZh = request.Address?.Zh.Trim() ?? string.Empty;
        venue.Capacity = request.Capacity; venue.IsActive = request.IsActive;
        venue.ConcurrencyToken = Guid.NewGuid(); venue.UpdatedUtc = DateTime.UtcNow;
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException) { return AppResult<EventVenueDto>.PreconditionFailed("The venue changed while saving; reload and try again."); }
        return AppResult<EventVenueDto>.Success(ToVenueDto(venue));
    }

    public async Task<AppResult<EventVenueWorkspaceDto>> GetWorkspaceAsync(Guid eventId, Guid memberId, CancellationToken ct)
    {
        var groupEvent = await db.GroupEvents.AsNoTracking().FirstOrDefaultAsync(x => x.Id == eventId, ct);
        if (groupEvent is null) return AppResult<EventVenueWorkspaceDto>.NotFound("Event not found.");
        if (!await IsModuleEnabled(eventId, ct))
            return AppResult<EventVenueWorkspaceDto>.Conflict("PLACE.RESOURCE is not enabled by the accepted plan.");
        if (!await CanCoordinate(groupEvent, memberId, ct))
            return AppResult<EventVenueWorkspaceDto>.Forbidden("Accepted resource coordinator access is required.");
        return AppResult<EventVenueWorkspaceDto>.Success(await BuildWorkspace(groupEvent, memberId, ct));
    }

    public async Task<AppResult<EventVenueWorkspaceDto>> ReserveAsync(Guid eventId, Guid memberId, ReserveEventVenueRequest request, string? ifMatch, string? idempotencyKey, CancellationToken ct)
    {
        var groupEvent = await db.GroupEvents.FirstOrDefaultAsync(x => x.Id == eventId, ct);
        if (groupEvent is null) return AppResult<EventVenueWorkspaceDto>.NotFound("Event not found.");
        if (!await IsModuleEnabled(eventId, ct))
            return AppResult<EventVenueWorkspaceDto>.Conflict("PLACE.RESOURCE is not enabled by the accepted plan.");
        if (!await CanCoordinate(groupEvent, memberId, ct))
            return AppResult<EventVenueWorkspaceDto>.Forbidden("Accepted resource coordinator access is required.");
        var keyError = ValidateIdempotencyKey(idempotencyKey);
        if (keyError is not null) return AppResult<EventVenueWorkspaceDto>.Validation(keyError);
        var validation = ValidateReservation(request);
        if (validation is not null) return AppResult<EventVenueWorkspaceDto>.Validation(validation);
        var normalizedKey = idempotencyKey!.Trim();
        var requestHash = EventCompositionEngine.Hash(new { eventId, memberId, request });
        var retry = await FindIdempotent(ReserveOperation, eventId, normalizedKey, requestHash, ct);
        if (!retry.IsSuccess) return ConvertFailure<EventVenueWorkspaceDto, EventIdempotencyRecord?>(retry);
        if (retry.Value is not null) return AppResult<EventVenueWorkspaceDto>.Success(await BuildWorkspace(groupEvent, memberId, ct));

        EventOccurrence? occurrence = null;
        if (request.EventOccurrenceId.HasValue)
        {
            occurrence = await db.EventOccurrences.AsNoTracking().FirstOrDefaultAsync(x =>
                x.Id == request.EventOccurrenceId && x.EventId == eventId, ct);
            if (occurrence is null) return AppResult<EventVenueWorkspaceDto>.Validation("The occurrence does not belong to this event.");
            if (occurrence.Status == EventOccurrenceStatus.Cancelled)
                return AppResult<EventVenueWorkspaceDto>.Conflict("A cancelled occurrence cannot reserve a venue.");
            if (!Overlaps(request.StartUtc, request.EndUtc, occurrence.StartUtc, occurrence.EndUtc))
                return AppResult<EventVenueWorkspaceDto>.Validation("An occurrence reservation must overlap its occurrence interval.");
        }
        else if (!Overlaps(request.StartUtc, request.EndUtc, groupEvent.StartDate, groupEvent.EndDate))
        {
            return AppResult<EventVenueWorkspaceDto>.Validation("An event reservation must overlap its event interval.");
        }

        var venue = await db.EventVenues.FirstOrDefaultAsync(x => x.Id == request.VenueId && x.ManagingGroupId == groupEvent.GroupId, ct);
        if (venue is null) return AppResult<EventVenueWorkspaceDto>.NotFound("Venue not found in the event's owning group catalogue.");
        if (!venue.IsActive) return AppResult<EventVenueWorkspaceDto>.Conflict($"Venue {venue.NameEn} is inactive.");
        if (!Matches(ifMatch, VenueETag(venue)))
            return AppResult<EventVenueWorkspaceDto>.PreconditionFailed("The venue catalogue changed; reload before reserving.");
        if (request.RequiredCapacity > venue.Capacity)
            return AppResult<EventVenueWorkspaceDto>.Validation($"Venue {venue.NameEn} capacity is {venue.Capacity}, below the requested {request.RequiredCapacity}.");

        var conflict = await db.EventVenueReservations.AsNoTracking()
            .Where(x => x.VenueId == venue.Id && x.Status == EventVenueReservationStatus.Confirmed &&
                x.StartUtc < request.EndUtc && request.StartUtc < x.EndUtc)
            .OrderBy(x => x.StartUtc).FirstOrDefaultAsync(ct);
        if (conflict is not null)
            return AppResult<EventVenueWorkspaceDto>.Conflict($"Venue {venue.NameEn} conflicts with an existing reservation {FormatInterval(conflict.StartUtc, conflict.EndUtc)}.");

        var now = DateTime.UtcNow;
        var reservation = new EventVenueReservation
        {
            Id = Guid.NewGuid(), VenueId = venue.Id, EventId = eventId, EventOccurrenceId = request.EventOccurrenceId,
            StartUtc = request.StartUtc, EndUtc = request.EndUtc, RequiredCapacity = request.RequiredCapacity,
            Status = EventVenueReservationStatus.Confirmed, ReservedByMemberId = memberId,
            CreatedUtc = now, UpdatedUtc = now
        };
        db.EventVenueReservations.Add(reservation);
        venue.ConcurrencyToken = Guid.NewGuid(); venue.UpdatedUtc = now;
        db.EventIdempotencyRecords.Add(NewIdempotency(ReserveOperation, eventId, normalizedKey, requestHash, reservation.Id, now));
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException) { return AppResult<EventVenueWorkspaceDto>.PreconditionFailed("The venue changed while reserving; reload to see the winning reservation."); }
        catch (DbUpdateException) { return AppResult<EventVenueWorkspaceDto>.Conflict("The reservation or idempotency key was changed by another request; reload and try again."); }
        return AppResult<EventVenueWorkspaceDto>.Success(await BuildWorkspace(groupEvent, memberId, ct));
    }

    public async Task<AppResult<EventVenueWorkspaceDto>> ReleaseAsync(Guid eventId, Guid reservationId, Guid memberId, string? ifMatch, string? idempotencyKey, CancellationToken ct)
    {
        var reservation = await db.EventVenueReservations.Include(x => x.Event).Include(x => x.Venue)
            .FirstOrDefaultAsync(x => x.Id == reservationId && x.EventId == eventId, ct);
        if (reservation is null) return AppResult<EventVenueWorkspaceDto>.NotFound("Venue reservation not found.");
        if (!await CanCoordinate(reservation.Event, memberId, ct))
            return AppResult<EventVenueWorkspaceDto>.Forbidden("Accepted resource coordinator access is required.");
        if (!await IsModuleEnabled(eventId, ct))
            return AppResult<EventVenueWorkspaceDto>.Conflict("PLACE.RESOURCE is not enabled by the accepted plan.");
        var keyError = ValidateIdempotencyKey(idempotencyKey);
        if (keyError is not null) return AppResult<EventVenueWorkspaceDto>.Validation(keyError);
        var normalizedKey = idempotencyKey!.Trim();
        var requestHash = EventCompositionEngine.Hash(new { eventId, reservationId, memberId });
        var retry = await FindIdempotent(ReleaseOperation, eventId, normalizedKey, requestHash, ct);
        if (!retry.IsSuccess) return ConvertFailure<EventVenueWorkspaceDto, EventIdempotencyRecord?>(retry);
        if (retry.Value is not null) return AppResult<EventVenueWorkspaceDto>.Success(await BuildWorkspace(reservation.Event, memberId, ct));
        if (!Matches(ifMatch, ReservationETag(reservation)))
            return AppResult<EventVenueWorkspaceDto>.PreconditionFailed("The reservation changed; reload before releasing.");
        if (reservation.Status != EventVenueReservationStatus.Confirmed)
            return AppResult<EventVenueWorkspaceDto>.Conflict("The reservation is already released.");

        var now = DateTime.UtcNow;
        reservation.Status = EventVenueReservationStatus.Released; reservation.ReleasedByMemberId = memberId;
        reservation.ReleasedUtc = now; reservation.UpdatedUtc = now; reservation.ConcurrencyToken = Guid.NewGuid();
        reservation.Venue.ConcurrencyToken = Guid.NewGuid(); reservation.Venue.UpdatedUtc = now;
        db.EventIdempotencyRecords.Add(NewIdempotency(ReleaseOperation, eventId, normalizedKey, requestHash, reservation.Id, now));
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException) { return AppResult<EventVenueWorkspaceDto>.PreconditionFailed("The venue or reservation changed while releasing; reload and try again."); }
        catch (DbUpdateException) { return AppResult<EventVenueWorkspaceDto>.Conflict("The release or idempotency key was changed by another request; reload and try again."); }
        return AppResult<EventVenueWorkspaceDto>.Success(await BuildWorkspace(reservation.Event, memberId, ct));
    }

    private async Task<EventVenueWorkspaceDto> BuildWorkspace(GroupEvent groupEvent, Guid memberId, CancellationToken ct)
    {
        var venues = await db.EventVenues.AsNoTracking().Where(x => x.ManagingGroupId == groupEvent.GroupId)
            .OrderByDescending(x => x.IsActive).ThenBy(x => x.NameEn).ToListAsync(ct);
        var reservations = await db.EventVenueReservations.AsNoTracking().Where(x => x.EventId == groupEvent.Id)
            .Include(x => x.Venue).OrderBy(x => x.StartUtc).ThenBy(x => x.CreatedUtc).ToListAsync(ct);
        var active = reservations.Where(x => x.Status == EventVenueReservationStatus.Confirmed).ToArray();
        var activeVenueIds = active.Select(x => x.VenueId).Distinct().ToArray();
        var candidates = activeVenueIds.Length == 0 ? [] : await db.EventVenueReservations.AsNoTracking()
            .Where(x => activeVenueIds.Contains(x.VenueId) && x.Status == EventVenueReservationStatus.Confirmed)
            .Include(x => x.Venue).OrderBy(x => x.StartUtc).ToListAsync(ct);
        var conflicts = active.SelectMany(own => candidates.Where(other => own.Id != other.Id && own.VenueId == other.VenueId &&
                Overlaps(own.StartUtc, own.EndUtc, other.StartUtc, other.EndUtc))
            .Select(other => new EventVenueConflictDto(other.VenueId, new(other.Venue.NameEn, other.Venue.NameZh),
                other.StartUtc, other.EndUtc)))
            .GroupBy(x => new { x.VenueId, x.StartUtc, x.EndUtc }).Select(x => x.First()).ToArray();
        var occurrences = await db.EventOccurrences.AsNoTracking().Where(x => x.EventId == groupEvent.Id && x.Status == EventOccurrenceStatus.Scheduled)
            .OrderBy(x => x.StartUtc).ToListAsync(ct);
        var capacitySufficient = active.All(x => x.RequiredCapacity <= x.Venue.Capacity);
        var bookingsConfirmed = occurrences.Count > 0
            ? occurrences.All(occurrence => active.Any(x => x.EventOccurrenceId == occurrence.Id ||
                (!x.EventOccurrenceId.HasValue && x.StartUtc <= occurrence.StartUtc && x.EndUtc >= occurrence.EndUtc)))
            : active.Length > 0;
        var conflictsResolved = conflicts.Length == 0;
        var blockers = new List<LocalizedTextDto>();
        if (!capacitySufficient) blockers.Add(new("At least one venue reservation exceeds the venue capacity.", "至少一項場地預訂超過場地容量。"));
        if (!bookingsConfirmed) blockers.Add(new("Every scheduled occurrence needs a confirmed venue reservation.", "每個已排程場次都需要已確認的場地預訂。"));
        foreach (var conflict in conflicts)
            blockers.Add(new($"Venue {conflict.VenueName.En} conflicts at {FormatInterval(conflict.StartUtc, conflict.EndUtc)}.",
                $"場地「{conflict.VenueName.Zh}」在 {FormatInterval(conflict.StartUtc, conflict.EndUtc)} 發生衝突。"));
        return new(groupEvent.Id, groupEvent.GroupId, venues.Select(ToVenueDto).ToArray(),
            reservations.Select(ToReservationDto).ToArray(), conflicts,
            new(capacitySufficient, bookingsConfirmed, conflictsResolved, blockers), true,
            await CanManageCatalogue(groupEvent.GroupId, memberId, ct), true);
    }

    private async Task<bool> CanManageCatalogue(Guid groupId, Guid memberId, CancellationToken ct)
        => await authorization.IsLeaderOrCoLeaderAsync(groupId, memberId, ct) ||
           await db.GroupEvents.AsNoTracking().AnyAsync(x => x.GroupId == groupId &&
               x.AccountableOwnerMemberId == memberId && !x.IsDeleted, ct) ||
           await db.EventRoleAssignments.AsNoTracking().AnyAsync(x => x.Event.GroupId == groupId && x.MemberId == memberId &&
               x.RoleRequirementKey == CoordinatorRoleKey && x.Status == EventRoleAssignmentStatus.Accepted && x.EndedUtc == null, ct);

    private async Task<bool> CanCoordinate(GroupEvent groupEvent, Guid memberId, CancellationToken ct)
        => await EventCompositionPersistence.CanManageEventAsync(db, authorization, groupEvent, memberId, ct) ||
           await db.EventRoleAssignments.AsNoTracking().AnyAsync(x => x.EventId == groupEvent.Id && x.MemberId == memberId &&
               x.RoleRequirementKey == CoordinatorRoleKey && x.Status == EventRoleAssignmentStatus.Accepted && x.EndedUtc == null, ct);

    private async Task<bool> IsModuleEnabled(Guid eventId, CancellationToken ct)
    {
        var snapshot = await db.EventPlanSnapshots.AsNoTracking().Where(x => x.EventId == eventId && x.IsActive)
            .OrderByDescending(x => x.Version).FirstOrDefaultAsync(ct);
        if (snapshot is null) return false;
        try { return EventCompositionPersistence.ToSnapshotDto(snapshot).Plan.ModuleDecisions.Any(x => x.ModuleCode == ModuleCode &&
            x.Status is EventModuleDecisionStatus.Required or EventModuleDecisionStatus.Selected); }
        catch (System.Text.Json.JsonException) { return false; }
    }

    private async Task<AppResult<EventIdempotencyRecord?>> FindIdempotent(string operation, Guid scopeId, string key, string requestHash, CancellationToken ct)
    {
        var existing = await db.EventIdempotencyRecords.AsNoTracking().FirstOrDefaultAsync(x =>
            x.Operation == operation && x.ScopeId == scopeId && x.Key == key, ct);
        if (existing is null) return AppResult<EventIdempotencyRecord?>.Success(null);
        return string.Equals(existing.RequestHash, requestHash, StringComparison.Ordinal)
            ? AppResult<EventIdempotencyRecord?>.Success(existing)
            : AppResult<EventIdempotencyRecord?>.Conflict("The Idempotency-Key was already used with a different request.");
    }

    private static EventIdempotencyRecord NewIdempotency(string operation, Guid scopeId, string key, string requestHash, Guid resultId, DateTime now)
        => new() { Id = Guid.NewGuid(), Operation = operation, ScopeId = scopeId, Key = key, RequestHash = requestHash,
            ResultEntityId = resultId, CreatedUtc = now, ExpiresUtc = now.AddHours(24) };
    private static string? ValidateVenue(SaveEventVenueRequest x)
        => string.IsNullOrWhiteSpace(x.Name.En) || string.IsNullOrWhiteSpace(x.Name.Zh)
            ? "Bilingual venue names are required."
            : x.Capacity <= 0 ? "Venue capacity must be greater than zero." : null;
    private static string? ValidateReservation(ReserveEventVenueRequest x)
        => x.StartUtc.Kind != DateTimeKind.Utc || x.EndUtc.Kind != DateTimeKind.Utc
            ? "Reservation startUtc and endUtc must be UTC values."
            : x.EndUtc <= x.StartUtc ? "Reservation end must be after its start."
            : x.RequiredCapacity <= 0 ? "Required capacity must be greater than zero." : null;
    private static string? ValidateIdempotencyKey(string? value)
        => string.IsNullOrWhiteSpace(value) || value.Trim().Length > 200
            ? "A valid Idempotency-Key header is required." : null;
    private static bool Overlaps(DateTime start, DateTime end, DateTime otherStart, DateTime otherEnd)
        => start < otherEnd && otherStart < end;
    private static string FormatInterval(DateTime start, DateTime end)
        => $"{start:yyyy-MM-dd HH:mm}Z–{end:yyyy-MM-dd HH:mm}Z";
    private static string VenueETag(EventVenue x) => $"\"venue-{x.ConcurrencyToken:N}\"";
    private static string ReservationETag(EventVenueReservation x) => $"\"venue-reservation-{x.ConcurrencyToken:N}\"";
    private static bool Matches(string? actual, string expected)
        => !string.IsNullOrWhiteSpace(actual) && string.Equals(actual.Trim(), expected, StringComparison.Ordinal);
    private static EventVenueDto ToVenueDto(EventVenue x) => new(x.Id, x.ManagingGroupId,
        new(x.NameEn, x.NameZh), new(x.AddressEn, x.AddressZh), x.Capacity, x.IsActive,
        VenueETag(x), x.CreatedUtc, x.UpdatedUtc);
    private static EventVenueReservationDto ToReservationDto(EventVenueReservation x) => new(x.Id, x.VenueId, x.EventId,
        x.EventOccurrenceId, new(x.Venue.NameEn, x.Venue.NameZh), x.Venue.Capacity, x.StartUtc, x.EndUtc,
        x.RequiredCapacity, x.Status, x.ReservedByMemberId, x.ReleasedByMemberId, x.ReleasedUtc,
        ReservationETag(x), x.CreatedUtc, x.UpdatedUtc);
    private static AppResult<TTarget> ConvertFailure<TTarget, TSource>(AppResult<TSource> source) => source.Status switch
    {
        AppResultStatus.NotFound => AppResult<TTarget>.NotFound(source.Message!),
        AppResultStatus.Forbidden => AppResult<TTarget>.Forbidden(source.Message!),
        AppResultStatus.Conflict => AppResult<TTarget>.Conflict(source.Message!),
        AppResultStatus.PreconditionFailed => AppResult<TTarget>.PreconditionFailed(source.Message!),
        _ => AppResult<TTarget>.Validation(source.Message ?? "Request failed.")
    };
}
