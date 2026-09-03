using System.Text.Json;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Services;

public sealed class EventTravelService(
    IAlifeDbContext db,
    IGroupAuthorizationService authorization,
    IEventPackageInvalidationService? packageInvalidation = null) : IEventTravelService
{
    private const string ModuleCode = "MOVE.STAY";
    private const string CoordinatorRoleKey = "MOVE.STAY:travel.coordinator";
    private const string Classification = "roleRestricted";

    public async Task<AppResult<EventTravelWorkspaceDto>> GetWorkspaceAsync(Guid eventId, Guid memberId, CancellationToken ct)
    {
        var access = await RequireCoordinator(eventId, memberId, ct);
        return !access.IsSuccess
            ? ConvertFailure<EventTravelWorkspaceDto, GroupEvent>(access)
            : AppResult<EventTravelWorkspaceDto>.Success(await BuildWorkspace(access.Value!, ct));
    }

    public async Task<AppResult<EventTravelMyJourneysDto>> GetMyJourneysAsync(Guid eventId, Guid memberId, CancellationToken ct)
    {
        var groupEvent = await db.GroupEvents.AsNoTracking().FirstOrDefaultAsync(x => x.Id == eventId, ct);
        if (groupEvent is null) return AppResult<EventTravelMyJourneysDto>.NotFound("Event not found.");
        if (!await IsModuleEnabled(eventId, ct))
            return AppResult<EventTravelMyJourneysDto>.Conflict("MOVE.STAY is not enabled by the accepted plan.");
        var participant = await authorization.IsApprovedMemberAsync(groupEvent.GroupId, memberId, ct) ||
            await db.EventEnrollments.AsNoTracking().AnyAsync(x => x.EventId == eventId && x.MemberId == memberId, ct) ||
            await db.EventTravelPassengerAssignments.AsNoTracking().AnyAsync(x => x.Journey.EventId == eventId &&
                x.MemberId == memberId && x.EndedUtc == null, ct) ||
            await db.EventTravelDrivers.AsNoTracking().AnyAsync(x => x.EventId == eventId && x.MemberId == memberId && x.IsActive, ct);
        if (!participant) return AppResult<EventTravelMyJourneysDto>.Forbidden("Event participation is required.");

        var journeys = await JourneyQuery(eventId).AsNoTracking()
            .Where(x => x.Status != EventTravelJourneyStatus.Cancelled &&
                (x.Driver != null && x.Driver.MemberId == memberId ||
                 x.PassengerAssignments.Any(a => a.MemberId == memberId && a.EndedUtc == null)))
            .OrderBy(x => x.StartUtc).ToListAsync(ct);
        var own = journeys.Select(x =>
        {
            var assignment = x.PassengerAssignments.FirstOrDefault(a => a.MemberId == memberId && !a.EndedUtc.HasValue);
            return new EventTravelMyJourneyDto(
                x.Id, x.EventOccurrenceId, new(x.NameEn, x.NameZh), x.StartUtc, x.EndUtc,
                x.Driver?.Member.DisplayName,
                x.Vehicle is null ? null : new(x.Vehicle.NameEn, x.Vehicle.NameZh),
                x.Vehicle?.RegistrationReference,
                assignment is null ? null : new(assignment.PickupStop.NameEn, assignment.PickupStop.NameZh),
                assignment is null ? null : new(assignment.PickupStop.AddressEn, assignment.PickupStop.AddressZh),
                assignment?.PickupStop.PickupUtc,
                x.Status);
        }).ToArray();
        return AppResult<EventTravelMyJourneysDto>.Success(new(eventId, own, "userSpecific"));
    }

    public async Task<AppResult<EventTravelWorkspaceDto>> CreateDriverAsync(Guid eventId, Guid memberId, SaveEventTravelDriverRequest request, string? idempotencyKey, CancellationToken ct)
    {
        var access = await RequireCoordinator(eventId, memberId, ct);
        if (!access.IsSuccess) return ConvertFailure<EventTravelWorkspaceDto, GroupEvent>(access);
        var validation = ValidateDriver(request);
        if (validation is not null) return AppResult<EventTravelWorkspaceDto>.Validation(validation);
        if (!await IsEventParticipant(access.Value!, request.MemberId, ct))
            return AppResult<EventTravelWorkspaceDto>.Validation("The driver must be an approved group member or enrolled participant.");
        var retry = await BeginIdempotent("travel.driver.create", eventId, memberId, request, idempotencyKey, ct);
        if (!retry.IsSuccess) return ConvertFailure<EventTravelWorkspaceDto, EventIdempotencyRecord?>(retry);
        if (retry.Value is not null) return AppResult<EventTravelWorkspaceDto>.Success(await BuildWorkspace(access.Value!, ct));
        if (await db.EventTravelDrivers.AnyAsync(x => x.EventId == eventId && x.MemberId == request.MemberId, ct))
            return AppResult<EventTravelWorkspaceDto>.Conflict("A driver record already exists for this event participant.");
        var now = DateTime.UtcNow;
        var entity = new EventTravelDriver
        {
            Id = Guid.NewGuid(), EventId = eventId, MemberId = request.MemberId,
            LicenceClass = request.LicenceClass.Trim(), LicenceExpiresOn = request.LicenceExpiresOn,
            LicenceConfirmed = request.LicenceConfirmed, FitToDriveConfirmed = request.FitToDriveConfirmed,
            EvidenceNotes = request.EvidenceNotes?.Trim() ?? string.Empty, IsActive = request.IsActive,
            VerifiedByMemberId = memberId, VerifiedUtc = now, CreatedUtc = now, UpdatedUtc = now
        };
        db.EventTravelDrivers.Add(entity);
        db.EventIdempotencyRecords.Add(NewIdempotency("travel.driver.create", eventId, idempotencyKey!, memberId, request, entity.Id, now));
        return await SaveWorkspace(access.Value!, memberId, "The driver or idempotency key changed concurrently; reload and try again.", ct);
    }

    public async Task<AppResult<EventTravelWorkspaceDto>> UpdateDriverAsync(Guid eventId, Guid driverId, Guid memberId, SaveEventTravelDriverRequest request, string? ifMatch, CancellationToken ct)
    {
        var access = await RequireCoordinator(eventId, memberId, ct);
        if (!access.IsSuccess) return ConvertFailure<EventTravelWorkspaceDto, GroupEvent>(access);
        var entity = await db.EventTravelDrivers.FirstOrDefaultAsync(x => x.Id == driverId && x.EventId == eventId, ct);
        if (entity is null) return AppResult<EventTravelWorkspaceDto>.NotFound("Driver record not found.");
        if (!Matches(ifMatch, DriverETag(entity))) return AppResult<EventTravelWorkspaceDto>.PreconditionFailed("The driver evidence changed; reload before saving.");
        var validation = ValidateDriver(request);
        if (validation is not null) return AppResult<EventTravelWorkspaceDto>.Validation(validation);
        if (entity.MemberId != request.MemberId)
            return AppResult<EventTravelWorkspaceDto>.Validation("A driver record cannot be reassigned to another member.");
        if (!request.IsActive && await db.EventTravelJourneys.AnyAsync(x => x.DriverId == entity.Id && x.Status != EventTravelJourneyStatus.Cancelled, ct))
            return AppResult<EventTravelWorkspaceDto>.Conflict("Reassign or cancel active journeys before deactivating this driver.");
        entity.LicenceClass = request.LicenceClass.Trim(); entity.LicenceExpiresOn = request.LicenceExpiresOn;
        entity.LicenceConfirmed = request.LicenceConfirmed; entity.FitToDriveConfirmed = request.FitToDriveConfirmed;
        entity.EvidenceNotes = request.EvidenceNotes?.Trim() ?? string.Empty; entity.IsActive = request.IsActive;
        entity.VerifiedByMemberId = memberId; entity.VerifiedUtc = DateTime.UtcNow;
        entity.UpdatedUtc = entity.VerifiedUtc; entity.ConcurrencyToken = Guid.NewGuid();
        return await SaveWorkspace(access.Value!, memberId, "The driver evidence changed while saving; reload and try again.", ct);
    }

    public async Task<AppResult<EventTravelWorkspaceDto>> CreateVehicleAsync(Guid eventId, Guid memberId, SaveEventTravelVehicleRequest request, string? idempotencyKey, CancellationToken ct)
    {
        var access = await RequireCoordinator(eventId, memberId, ct);
        if (!access.IsSuccess) return ConvertFailure<EventTravelWorkspaceDto, GroupEvent>(access);
        var validation = ValidateVehicle(request);
        if (validation is not null) return AppResult<EventTravelWorkspaceDto>.Validation(validation);
        var retry = await BeginIdempotent("travel.vehicle.create", eventId, memberId, request, idempotencyKey, ct);
        if (!retry.IsSuccess) return ConvertFailure<EventTravelWorkspaceDto, EventIdempotencyRecord?>(retry);
        if (retry.Value is not null) return AppResult<EventTravelWorkspaceDto>.Success(await BuildWorkspace(access.Value!, ct));
        var reference = request.RegistrationReference.Trim().ToUpperInvariant();
        if (await db.EventTravelVehicles.AnyAsync(x => x.EventId == eventId && x.RegistrationReference == reference, ct))
            return AppResult<EventTravelWorkspaceDto>.Conflict("A vehicle with this registration reference already exists for the event.");
        var now = DateTime.UtcNow;
        var entity = new EventTravelVehicle
        {
            Id = Guid.NewGuid(), EventId = eventId, NameEn = request.Name.En.Trim(), NameZh = request.Name.Zh.Trim(),
            RegistrationReference = reference, SeatCapacity = request.SeatCapacity,
            RegistrationConfirmed = request.RegistrationConfirmed, RegistrationExpiresOn = request.RegistrationExpiresOn,
            WofConfirmed = request.WofConfirmed, WofExpiresOn = request.WofExpiresOn,
            EvidenceNotes = request.EvidenceNotes?.Trim() ?? string.Empty, IsActive = request.IsActive,
            VerifiedByMemberId = memberId, VerifiedUtc = now, CreatedUtc = now, UpdatedUtc = now
        };
        db.EventTravelVehicles.Add(entity);
        db.EventIdempotencyRecords.Add(NewIdempotency("travel.vehicle.create", eventId, idempotencyKey!, memberId, request, entity.Id, now));
        return await SaveWorkspace(access.Value!, memberId, "The vehicle or idempotency key changed concurrently; reload and try again.", ct);
    }

    public async Task<AppResult<EventTravelWorkspaceDto>> UpdateVehicleAsync(Guid eventId, Guid vehicleId, Guid memberId, SaveEventTravelVehicleRequest request, string? ifMatch, CancellationToken ct)
    {
        var access = await RequireCoordinator(eventId, memberId, ct);
        if (!access.IsSuccess) return ConvertFailure<EventTravelWorkspaceDto, GroupEvent>(access);
        var entity = await db.EventTravelVehicles.FirstOrDefaultAsync(x => x.Id == vehicleId && x.EventId == eventId, ct);
        if (entity is null) return AppResult<EventTravelWorkspaceDto>.NotFound("Vehicle record not found.");
        if (!Matches(ifMatch, VehicleETag(entity))) return AppResult<EventTravelWorkspaceDto>.PreconditionFailed("The vehicle evidence changed; reload before saving.");
        var validation = ValidateVehicle(request);
        if (validation is not null) return AppResult<EventTravelWorkspaceDto>.Validation(validation);
        var activeJourneys = await db.EventTravelJourneys.Where(x => x.VehicleId == vehicleId && x.Status != EventTravelJourneyStatus.Cancelled)
            .Select(x => new { x.Id, PassengerCount = x.PassengerAssignments.Count(a => a.EndedUtc == null) }).ToListAsync(ct);
        if (!request.IsActive && activeJourneys.Count > 0)
            return AppResult<EventTravelWorkspaceDto>.Conflict("Reassign or cancel active journeys before deactivating this vehicle.");
        if (activeJourneys.Any(x => x.PassengerCount > request.SeatCapacity))
            return AppResult<EventTravelWorkspaceDto>.Conflict("Vehicle capacity cannot be reduced below an active passenger manifest count.");
        var reference = request.RegistrationReference.Trim().ToUpperInvariant();
        if (await db.EventTravelVehicles.AnyAsync(x => x.EventId == eventId && x.Id != vehicleId && x.RegistrationReference == reference, ct))
            return AppResult<EventTravelWorkspaceDto>.Conflict("A vehicle with this registration reference already exists for the event.");
        entity.NameEn = request.Name.En.Trim(); entity.NameZh = request.Name.Zh.Trim(); entity.RegistrationReference = reference;
        entity.SeatCapacity = request.SeatCapacity; entity.RegistrationConfirmed = request.RegistrationConfirmed;
        entity.RegistrationExpiresOn = request.RegistrationExpiresOn; entity.WofConfirmed = request.WofConfirmed;
        entity.WofExpiresOn = request.WofExpiresOn; entity.EvidenceNotes = request.EvidenceNotes?.Trim() ?? string.Empty;
        entity.IsActive = request.IsActive; entity.VerifiedByMemberId = memberId; entity.VerifiedUtc = DateTime.UtcNow;
        entity.UpdatedUtc = entity.VerifiedUtc; entity.ConcurrencyToken = Guid.NewGuid();
        return await SaveWorkspace(access.Value!, memberId, "The vehicle evidence changed while saving; reload and try again.", ct);
    }

    public async Task<AppResult<EventTravelWorkspaceDto>> CreateJourneyAsync(Guid eventId, Guid memberId, CreateEventTravelJourneyRequest request, string? idempotencyKey, CancellationToken ct)
    {
        var access = await RequireCoordinator(eventId, memberId, ct);
        if (!access.IsSuccess) return ConvertFailure<EventTravelWorkspaceDto, GroupEvent>(access);
        var validation = ValidateJourney(request.Name, request.StartUtc, request.EndUtc);
        if (validation is not null) return AppResult<EventTravelWorkspaceDto>.Validation(validation);
        var retry = await BeginIdempotent("travel.journey.create", eventId, memberId, request, idempotencyKey, ct);
        if (!retry.IsSuccess) return ConvertFailure<EventTravelWorkspaceDto, EventIdempotencyRecord?>(retry);
        if (retry.Value is not null) return AppResult<EventTravelWorkspaceDto>.Success(await BuildWorkspace(access.Value!, ct));
        var occurrence = await db.EventOccurrences.AsNoTracking().FirstOrDefaultAsync(x => x.Id == request.EventOccurrenceId && x.EventId == eventId, ct);
        if (occurrence is null) return AppResult<EventTravelWorkspaceDto>.Validation("The occurrence does not belong to this event.");
        if (occurrence.Status == EventOccurrenceStatus.Cancelled) return AppResult<EventTravelWorkspaceDto>.Conflict("A cancelled occurrence cannot have a journey.");
        if (request.StartUtc < occurrence.StartUtc.AddHours(-24) || request.EndUtc > occurrence.EndUtc.AddHours(24))
            return AppResult<EventTravelWorkspaceDto>.Validation("Journey times must remain within 24 hours of the occurrence interval.");
        var related = await ValidateJourneyResources(eventId, request.DriverId, request.VehicleId, ct);
        if (related is not null) return AppResult<EventTravelWorkspaceDto>.Validation(related);
        var now = DateTime.UtcNow;
        var entity = new EventTravelJourney
        {
            Id = Guid.NewGuid(), EventId = eventId, EventOccurrenceId = request.EventOccurrenceId,
            NameEn = request.Name.En.Trim(), NameZh = request.Name.Zh.Trim(), StartUtc = request.StartUtc, EndUtc = request.EndUtc,
            DriverId = request.DriverId, VehicleId = request.VehicleId, CreatedByMemberId = memberId,
            CreatedUtc = now, UpdatedUtc = now
        };
        db.EventTravelJourneys.Add(entity);
        db.EventIdempotencyRecords.Add(NewIdempotency("travel.journey.create", eventId, idempotencyKey!, memberId, request, entity.Id, now));
        return await SaveWorkspace(access.Value!, memberId, "The journey or idempotency key changed concurrently; reload and try again.", ct);
    }

    public async Task<AppResult<EventTravelWorkspaceDto>> UpdateJourneyAsync(Guid eventId, Guid journeyId, Guid memberId, UpdateEventTravelJourneyRequest request, string? ifMatch, CancellationToken ct)
    {
        var access = await RequireCoordinator(eventId, memberId, ct);
        if (!access.IsSuccess) return ConvertFailure<EventTravelWorkspaceDto, GroupEvent>(access);
        var journey = await JourneyQuery(eventId).FirstOrDefaultAsync(x => x.Id == journeyId, ct);
        if (journey is null) return AppResult<EventTravelWorkspaceDto>.NotFound("Journey not found.");
        if (!Matches(ifMatch, JourneyETag(journey))) return AppResult<EventTravelWorkspaceDto>.PreconditionFailed("The journey changed; reload before saving.");
        var validation = ValidateJourney(request.Name, request.StartUtc, request.EndUtc);
        if (validation is not null) return AppResult<EventTravelWorkspaceDto>.Validation(validation);
        if (request.StartUtc < journey.EventOccurrence.StartUtc.AddHours(-24) || request.EndUtc > journey.EventOccurrence.EndUtc.AddHours(24))
            return AppResult<EventTravelWorkspaceDto>.Validation("Journey times must remain within 24 hours of the occurrence interval.");
        if (journey.PickupStops.Any(x => x.PickupUtc < request.StartUtc || x.PickupUtc > request.EndUtc))
            return AppResult<EventTravelWorkspaceDto>.Conflict("Move existing pickup stops inside the proposed journey interval first.");
        var related = await ValidateJourneyResources(eventId, request.DriverId, request.VehicleId, ct);
        if (related is not null) return AppResult<EventTravelWorkspaceDto>.Validation(related);
        var activePassengers = journey.PassengerAssignments.Count(x => !x.EndedUtc.HasValue);
        if (request.VehicleId.HasValue)
        {
            var capacity = await db.EventTravelVehicles.AsNoTracking().Where(x => x.Id == request.VehicleId).Select(x => x.SeatCapacity).SingleAsync(ct);
            if (activePassengers > capacity) return AppResult<EventTravelWorkspaceDto>.Conflict($"The manifest has {activePassengers} passengers but the selected vehicle seats {capacity}.");
        }
        if (request.ManifestConfirmed && (journey.PickupStops.Count == 0 || activePassengers == 0))
            return AppResult<EventTravelWorkspaceDto>.Validation("A manifest needs a pickup stop and at least one passenger before confirmation.");
        journey.NameEn = request.Name.En.Trim(); journey.NameZh = request.Name.Zh.Trim();
        journey.StartUtc = request.StartUtc; journey.EndUtc = request.EndUtc; journey.DriverId = request.DriverId; journey.VehicleId = request.VehicleId;
        journey.ManifestConfirmed = request.ManifestConfirmed; journey.Status = request.Status;
        journey.ConcurrencyToken = Guid.NewGuid(); journey.UpdatedUtc = DateTime.UtcNow;
        return await SaveWorkspace(access.Value!, memberId, "The journey changed while saving; reload and try again.", ct);
    }

    public async Task<AppResult<EventTravelWorkspaceDto>> AddPickupStopAsync(Guid eventId, Guid journeyId, Guid memberId, SaveEventTravelPickupStopRequest request, string? ifMatch, string? idempotencyKey, CancellationToken ct)
    {
        var access = await RequireCoordinator(eventId, memberId, ct);
        if (!access.IsSuccess) return ConvertFailure<EventTravelWorkspaceDto, GroupEvent>(access);
        var journey = await JourneyQuery(eventId).FirstOrDefaultAsync(x => x.Id == journeyId, ct);
        if (journey is null) return AppResult<EventTravelWorkspaceDto>.NotFound("Journey not found.");
        if (!Matches(ifMatch, JourneyETag(journey))) return AppResult<EventTravelWorkspaceDto>.PreconditionFailed("The journey changed; reload before adding a pickup stop.");
        var validation = ValidateStop(journey, request);
        if (validation is not null) return AppResult<EventTravelWorkspaceDto>.Validation(validation);
        var retry = await BeginIdempotent("travel.stop.create", journeyId, memberId, request, idempotencyKey, ct);
        if (!retry.IsSuccess) return ConvertFailure<EventTravelWorkspaceDto, EventIdempotencyRecord?>(retry);
        if (retry.Value is not null) return AppResult<EventTravelWorkspaceDto>.Success(await BuildWorkspace(access.Value!, ct));
        if (journey.PickupStops.Any(x => x.SortOrder == request.SortOrder))
            return AppResult<EventTravelWorkspaceDto>.Conflict("Pickup stop order must be unique within the journey.");
        var now = DateTime.UtcNow;
        var entity = new EventTravelPickupStop
        {
            Id = Guid.NewGuid(), JourneyId = journeyId, SortOrder = request.SortOrder,
            NameEn = request.Name.En.Trim(), NameZh = request.Name.Zh.Trim(),
            AddressEn = request.Address?.En.Trim() ?? string.Empty, AddressZh = request.Address?.Zh.Trim() ?? string.Empty,
            PickupUtc = request.PickupUtc, CreatedUtc = now, UpdatedUtc = now
        };
        db.EventTravelPickupStops.Add(entity); journey.ManifestConfirmed = false;
        journey.ConcurrencyToken = Guid.NewGuid(); journey.UpdatedUtc = now;
        db.EventIdempotencyRecords.Add(NewIdempotency("travel.stop.create", journeyId, idempotencyKey!, memberId, request, entity.Id, now));
        return await SaveWorkspace(access.Value!, memberId, "The journey or pickup stop changed concurrently; reload and try again.", ct);
    }

    public async Task<AppResult<EventTravelWorkspaceDto>> UpdatePickupStopAsync(Guid eventId, Guid journeyId, Guid stopId, Guid memberId, SaveEventTravelPickupStopRequest request, string? ifMatch, CancellationToken ct)
    {
        var access = await RequireCoordinator(eventId, memberId, ct);
        if (!access.IsSuccess) return ConvertFailure<EventTravelWorkspaceDto, GroupEvent>(access);
        var journey = await JourneyQuery(eventId).FirstOrDefaultAsync(x => x.Id == journeyId, ct);
        if (journey is null) return AppResult<EventTravelWorkspaceDto>.NotFound("Journey not found.");
        if (!Matches(ifMatch, JourneyETag(journey))) return AppResult<EventTravelWorkspaceDto>.PreconditionFailed("The journey changed; reload before saving the pickup stop.");
        var stop = journey.PickupStops.FirstOrDefault(x => x.Id == stopId);
        if (stop is null) return AppResult<EventTravelWorkspaceDto>.NotFound("Pickup stop not found.");
        var validation = ValidateStop(journey, request);
        if (validation is not null) return AppResult<EventTravelWorkspaceDto>.Validation(validation);
        if (journey.PickupStops.Any(x => x.Id != stopId && x.SortOrder == request.SortOrder))
            return AppResult<EventTravelWorkspaceDto>.Conflict("Pickup stop order must be unique within the journey.");
        stop.SortOrder = request.SortOrder; stop.NameEn = request.Name.En.Trim(); stop.NameZh = request.Name.Zh.Trim();
        stop.AddressEn = request.Address?.En.Trim() ?? string.Empty; stop.AddressZh = request.Address?.Zh.Trim() ?? string.Empty;
        stop.PickupUtc = request.PickupUtc; stop.UpdatedUtc = DateTime.UtcNow;
        journey.ManifestConfirmed = false; journey.ConcurrencyToken = Guid.NewGuid(); journey.UpdatedUtc = stop.UpdatedUtc;
        return await SaveWorkspace(access.Value!, memberId, "The journey changed while saving the pickup stop; reload and try again.", ct);
    }

    public async Task<AppResult<EventTravelWorkspaceDto>> AssignPassengerAsync(Guid eventId, Guid journeyId, Guid memberId, AssignEventTravelPassengerRequest request, string? ifMatch, string? idempotencyKey, CancellationToken ct)
    {
        var access = await RequireCoordinator(eventId, memberId, ct);
        if (!access.IsSuccess) return ConvertFailure<EventTravelWorkspaceDto, GroupEvent>(access);
        var journey = await JourneyQuery(eventId).FirstOrDefaultAsync(x => x.Id == journeyId, ct);
        if (journey is null) return AppResult<EventTravelWorkspaceDto>.NotFound("Journey not found.");
        if (!Matches(ifMatch, JourneyETag(journey))) return AppResult<EventTravelWorkspaceDto>.PreconditionFailed("The manifest changed; reload before assigning a passenger.");
        if (journey.Status == EventTravelJourneyStatus.Cancelled) return AppResult<EventTravelWorkspaceDto>.Conflict("A cancelled journey cannot accept passengers.");
        if (!journey.PickupStops.Any(x => x.Id == request.PickupStopId))
            return AppResult<EventTravelWorkspaceDto>.Validation("The pickup stop does not belong to this journey.");
        if (!await IsEventParticipant(access.Value!, request.MemberId, ct))
            return AppResult<EventTravelWorkspaceDto>.Validation("The passenger must be an approved group member or enrolled participant.");
        var retry = await BeginIdempotent("travel.passenger.assign", journeyId, memberId, request, idempotencyKey, ct);
        if (!retry.IsSuccess) return ConvertFailure<EventTravelWorkspaceDto, EventIdempotencyRecord?>(retry);
        if (retry.Value is not null) return AppResult<EventTravelWorkspaceDto>.Success(await BuildWorkspace(access.Value!, ct));
        if (journey.PassengerAssignments.Any(x => x.MemberId == request.MemberId && !x.EndedUtc.HasValue))
            return AppResult<EventTravelWorkspaceDto>.Conflict("The participant is already assigned to this journey.");
        var currentCount = journey.PassengerAssignments.Count(x => !x.EndedUtc.HasValue);
        if (journey.Vehicle is not null && currentCount >= journey.Vehicle.SeatCapacity)
            return AppResult<EventTravelWorkspaceDto>.Conflict($"Vehicle {journey.Vehicle.NameEn} is already at capacity {journey.Vehicle.SeatCapacity}.");
        var now = DateTime.UtcNow;
        var entity = new EventTravelPassengerAssignment
        {
            Id = Guid.NewGuid(), JourneyId = journeyId, MemberId = request.MemberId, PickupStopId = request.PickupStopId,
            AssignedByMemberId = memberId, AssignedUtc = now
        };
        db.EventTravelPassengerAssignments.Add(entity); journey.ManifestConfirmed = false;
        journey.ConcurrencyToken = Guid.NewGuid(); journey.UpdatedUtc = now;
        db.EventIdempotencyRecords.Add(NewIdempotency("travel.passenger.assign", journeyId, idempotencyKey!, memberId, request, entity.Id, now));
        return await SaveWorkspace(access.Value!, memberId, "The passenger assignment changed concurrently; reload and try again.", ct);
    }

    public async Task<AppResult<EventTravelWorkspaceDto>> RemovePassengerAsync(Guid eventId, Guid journeyId, Guid assignmentId, Guid memberId, string? ifMatch, string? idempotencyKey, CancellationToken ct)
    {
        var access = await RequireCoordinator(eventId, memberId, ct);
        if (!access.IsSuccess) return ConvertFailure<EventTravelWorkspaceDto, GroupEvent>(access);
        var journey = await JourneyQuery(eventId).FirstOrDefaultAsync(x => x.Id == journeyId, ct);
        if (journey is null) return AppResult<EventTravelWorkspaceDto>.NotFound("Journey not found.");
        if (!Matches(ifMatch, JourneyETag(journey))) return AppResult<EventTravelWorkspaceDto>.PreconditionFailed("The manifest changed; reload before removing a passenger.");
        var assignment = journey.PassengerAssignments.FirstOrDefault(x => x.Id == assignmentId);
        if (assignment is null) return AppResult<EventTravelWorkspaceDto>.NotFound("Passenger assignment not found.");
        var request = new { assignmentId };
        var retry = await BeginIdempotent("travel.passenger.remove", journeyId, memberId, request, idempotencyKey, ct);
        if (!retry.IsSuccess) return ConvertFailure<EventTravelWorkspaceDto, EventIdempotencyRecord?>(retry);
        if (retry.Value is not null) return AppResult<EventTravelWorkspaceDto>.Success(await BuildWorkspace(access.Value!, ct));
        if (assignment.EndedUtc.HasValue) return AppResult<EventTravelWorkspaceDto>.Conflict("The passenger assignment is already ended.");
        var now = DateTime.UtcNow;
        assignment.EndedByMemberId = memberId; assignment.EndedUtc = now;
        journey.ManifestConfirmed = false; journey.ConcurrencyToken = Guid.NewGuid(); journey.UpdatedUtc = now;
        db.EventIdempotencyRecords.Add(NewIdempotency("travel.passenger.remove", journeyId, idempotencyKey!, memberId, request, assignment.Id, now));
        return await SaveWorkspace(access.Value!, memberId, "The passenger assignment changed concurrently; reload and try again.", ct);
    }

    private async Task<AppResult<GroupEvent>> RequireCoordinator(Guid eventId, Guid memberId, CancellationToken ct)
    {
        var groupEvent = await db.GroupEvents.FirstOrDefaultAsync(x => x.Id == eventId, ct);
        if (groupEvent is null) return AppResult<GroupEvent>.NotFound("Event not found.");
        if (!await IsModuleEnabled(eventId, ct)) return AppResult<GroupEvent>.Conflict("MOVE.STAY is not enabled by the accepted plan.");
        if (!await CanCoordinate(groupEvent, memberId, ct)) return AppResult<GroupEvent>.Forbidden("Accepted travel coordinator access is required.");
        return AppResult<GroupEvent>.Success(groupEvent);
    }

    private async Task<EventTravelWorkspaceDto> BuildWorkspace(GroupEvent groupEvent, CancellationToken ct)
    {
        var occurrences = await db.EventOccurrences.AsNoTracking().Where(x => x.EventId == groupEvent.Id)
            .OrderBy(x => x.StartUtc).ToListAsync(ct);
        var drivers = await db.EventTravelDrivers.AsNoTracking().Where(x => x.EventId == groupEvent.Id)
            .Include(x => x.Member).OrderByDescending(x => x.IsActive).ThenBy(x => x.Member.DisplayName).ToListAsync(ct);
        var vehicles = await db.EventTravelVehicles.AsNoTracking().Where(x => x.EventId == groupEvent.Id)
            .OrderByDescending(x => x.IsActive).ThenBy(x => x.NameEn).ToListAsync(ct);
        var journeys = await JourneyQuery(groupEvent.Id).AsNoTracking().OrderBy(x => x.StartUtc).ToListAsync(ct);
        var ram = await db.EventRamAssessments.AsNoTracking().FirstOrDefaultAsync(x => x.EventId == groupEvent.Id, ct);
        var readiness = EventTravelReadiness.Evaluate(journeys, ram, await IsAccommodationRequired(groupEvent.Id, ct));
        var memberMap = new Dictionary<Guid, string>();
        var approvedMembers = await db.GroupMemberships.AsNoTracking().Where(x => x.GroupId == groupEvent.GroupId && x.Status == MembershipStatus.Approved)
            .Select(x => new { x.MemberId, x.Member.DisplayName }).ToListAsync(ct);
        foreach (var value in approvedMembers) memberMap[value.MemberId] = value.DisplayName ?? string.Empty;
        var enrolledMembers = await db.EventEnrollments.AsNoTracking().Where(x => x.EventId == groupEvent.Id)
            .Select(x => new { x.MemberId, x.Member.DisplayName }).ToListAsync(ct);
        foreach (var value in enrolledMembers) memberMap[value.MemberId] = value.DisplayName ?? string.Empty;
        var options = memberMap.OrderBy(x => x.Value).Select(x => new EventTravelMemberOptionDto(x.Key, x.Value)).ToArray();
        return new(groupEvent.Id,
            occurrences.Select(x => new EventOccurrenceDto(x.Id, x.EventId, x.StartUtc, x.EndUtc, x.LocalDate, x.Status, x.IsLegacyBackfill)).ToArray(),
            options, drivers.Select(x => ToDriverDto(x, DateOnly.FromDateTime(DateTime.UtcNow))).ToArray(),
            vehicles.Select(x => ToVehicleDto(x, DateOnly.FromDateTime(DateTime.UtcNow))).ToArray(),
            journeys.Select(ToJourneyDto).ToArray(), readiness.RamEvidence, readiness.Readiness, true, Classification);
    }

    private IQueryable<EventTravelJourney> JourneyQuery(Guid eventId) => db.EventTravelJourneys.Where(x => x.EventId == eventId)
        .Include(x => x.EventOccurrence)
        .Include(x => x.Driver).ThenInclude(x => x!.Member)
        .Include(x => x.Vehicle)
        .Include(x => x.PickupStops)
        .Include(x => x.PassengerAssignments).ThenInclude(x => x.Member)
        .Include(x => x.PassengerAssignments).ThenInclude(x => x.PickupStop);

    private async Task<bool> CanCoordinate(GroupEvent groupEvent, Guid memberId, CancellationToken ct)
        => await EventCompositionPersistence.CanManageEventAsync(db, authorization, groupEvent, memberId, ct) ||
           await db.EventRoleAssignments.AsNoTracking().AnyAsync(x => x.EventId == groupEvent.Id && x.MemberId == memberId &&
               x.RoleRequirementKey == CoordinatorRoleKey && x.Status == EventRoleAssignmentStatus.Accepted && x.EndedUtc == null, ct);

    private async Task<bool> IsEventParticipant(GroupEvent groupEvent, Guid memberId, CancellationToken ct)
        => await authorization.IsApprovedMemberAsync(groupEvent.GroupId, memberId, ct) ||
           await db.EventEnrollments.AsNoTracking().AnyAsync(x => x.EventId == groupEvent.Id && x.MemberId == memberId, ct);

    private async Task<bool> IsModuleEnabled(Guid eventId, CancellationToken ct)
    {
        var snapshot = await db.EventPlanSnapshots.AsNoTracking().Where(x => x.EventId == eventId && x.IsActive)
            .OrderByDescending(x => x.Version).FirstOrDefaultAsync(ct);
        if (snapshot is null) return false;
        try
        {
            return EventCompositionPersistence.ToSnapshotDto(snapshot).Plan.ModuleDecisions.Any(x => x.ModuleCode == ModuleCode &&
                x.Status is EventModuleDecisionStatus.Required or EventModuleDecisionStatus.Selected);
        }
        catch (JsonException) { return false; }
    }

    private async Task<bool> IsAccommodationRequired(Guid eventId, CancellationToken ct)
    {
        var snapshot = await db.EventPlanSnapshots.AsNoTracking().Where(x => x.EventId == eventId && x.IsActive)
            .OrderByDescending(x => x.Version).FirstOrDefaultAsync(ct);
        if (snapshot is null) return false;
        try
        {
            return EventCompositionPersistence.ToSnapshotDto(snapshot).Plan.Facts.Items.Any(x =>
                x.Code == "move.accommodationRequired" && x.Certainty == EventFactCertainty.Confirmed && x.Value is { } value &&
                value.ValueKind == JsonValueKind.True);
        }
        catch (JsonException) { return false; }
    }

    private async Task<string?> ValidateJourneyResources(Guid eventId, Guid? driverId, Guid? vehicleId, CancellationToken ct)
    {
        if (driverId.HasValue && !await db.EventTravelDrivers.AsNoTracking().AnyAsync(x => x.Id == driverId && x.EventId == eventId && x.IsActive, ct))
            return "The selected active driver does not belong to this event.";
        if (vehicleId.HasValue && !await db.EventTravelVehicles.AsNoTracking().AnyAsync(x => x.Id == vehicleId && x.EventId == eventId && x.IsActive, ct))
            return "The selected active vehicle does not belong to this event.";
        return null;
    }

    private async Task<AppResult<EventTravelWorkspaceDto>> SaveWorkspace(
        GroupEvent groupEvent, Guid actorMemberId, string conflictMessage, CancellationToken ct)
    {
        if (packageInvalidation is not null)
            await packageInvalidation.InvalidateForModuleChangeAsync(groupEvent, actorMemberId, ModuleCode,
                "event.travel.changed", "governanceCritical", ct);
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException) { return AppResult<EventTravelWorkspaceDto>.PreconditionFailed(conflictMessage); }
        catch (DbUpdateException) { return AppResult<EventTravelWorkspaceDto>.Conflict(conflictMessage); }
        return AppResult<EventTravelWorkspaceDto>.Success(await BuildWorkspace(groupEvent, ct));
    }

    private async Task<AppResult<EventIdempotencyRecord?>> BeginIdempotent<T>(string operation, Guid scopeId, Guid memberId, T request, string? key, CancellationToken ct)
    {
        var keyError = ValidateIdempotencyKey(key);
        if (keyError is not null) return AppResult<EventIdempotencyRecord?>.Validation(keyError);
        var hash = EventCompositionEngine.Hash(new { scopeId, memberId, request });
        var existing = await db.EventIdempotencyRecords.AsNoTracking().FirstOrDefaultAsync(x => x.Operation == operation && x.ScopeId == scopeId && x.Key == key!.Trim(), ct);
        if (existing is null) return AppResult<EventIdempotencyRecord?>.Success(null);
        return string.Equals(existing.RequestHash, hash, StringComparison.Ordinal)
            ? AppResult<EventIdempotencyRecord?>.Success(existing)
            : AppResult<EventIdempotencyRecord?>.Conflict("The Idempotency-Key was already used with a different request.");
    }

    private static EventIdempotencyRecord NewIdempotency<T>(string operation, Guid scopeId, string key, Guid memberId, T request, Guid resultId, DateTime now)
        => new()
        {
            Id = Guid.NewGuid(), Operation = operation, ScopeId = scopeId, Key = key.Trim(),
            RequestHash = EventCompositionEngine.Hash(new { scopeId, memberId, request }), ResultEntityId = resultId,
            CreatedUtc = now, ExpiresUtc = now.AddHours(24)
        };

    private static string? ValidateDriver(SaveEventTravelDriverRequest request)
        => string.IsNullOrWhiteSpace(request.LicenceClass) ? "Licence class is required."
            : request.LicenceClass.Trim().Length > 40 ? "Licence class is too long."
            : request.LicenceConfirmed && !request.LicenceExpiresOn.HasValue ? "Confirmed licence evidence needs an expiry date."
            : request.EvidenceNotes?.Length > 500 ? "Driver evidence notes are too long." : null;

    private static string? ValidateVehicle(SaveEventTravelVehicleRequest request)
        => string.IsNullOrWhiteSpace(request.Name.En) || string.IsNullOrWhiteSpace(request.Name.Zh) ? "Bilingual vehicle names are required."
            : string.IsNullOrWhiteSpace(request.RegistrationReference) ? "Vehicle registration reference is required."
            : request.SeatCapacity <= 0 ? "Vehicle seat capacity must be greater than zero."
            : request.RegistrationConfirmed && !request.RegistrationExpiresOn.HasValue ? "Confirmed registration evidence needs an expiry date."
            : request.WofConfirmed && !request.WofExpiresOn.HasValue ? "Confirmed WOF evidence needs an expiry date."
            : request.EvidenceNotes?.Length > 500 ? "Vehicle evidence notes are too long." : null;

    private static string? ValidateJourney(LocalizedTextDto name, DateTime start, DateTime end)
        => string.IsNullOrWhiteSpace(name.En) || string.IsNullOrWhiteSpace(name.Zh) ? "Bilingual journey names are required."
            : start.Kind != DateTimeKind.Utc || end.Kind != DateTimeKind.Utc ? "Journey startUtc and endUtc must be UTC values."
            : end <= start ? "Journey end must be after its start." : null;

    private static string? ValidateStop(EventTravelJourney journey, SaveEventTravelPickupStopRequest request)
        => request.SortOrder < 0 ? "Pickup stop order cannot be negative."
            : string.IsNullOrWhiteSpace(request.Name.En) || string.IsNullOrWhiteSpace(request.Name.Zh) ? "Bilingual pickup stop names are required."
            : request.PickupUtc.Kind != DateTimeKind.Utc ? "PickupUtc must be a UTC value."
            : request.PickupUtc < journey.StartUtc || request.PickupUtc > journey.EndUtc ? "Pickup time must be inside the journey interval."
            : null;

    private static string? ValidateIdempotencyKey(string? value)
        => string.IsNullOrWhiteSpace(value) || value.Trim().Length > 200 ? "A valid Idempotency-Key header is required." : null;
    private static bool Matches(string? actual, string expected)
        => !string.IsNullOrWhiteSpace(actual) && string.Equals(actual.Trim(), expected, StringComparison.Ordinal);
    private static string DriverETag(EventTravelDriver x) => $"\"travel-driver-{x.ConcurrencyToken:N}\"";
    private static string VehicleETag(EventTravelVehicle x) => $"\"travel-vehicle-{x.ConcurrencyToken:N}\"";
    private static string JourneyETag(EventTravelJourney x) => $"\"travel-journey-{x.ConcurrencyToken:N}\"";

    private static EventTravelDriverDto ToDriverDto(EventTravelDriver x, DateOnly localDate) => new(
        x.Id, x.EventId, x.MemberId, x.Member.DisplayName ?? string.Empty, x.LicenceClass, x.LicenceExpiresOn,
        x.LicenceConfirmed, x.FitToDriveConfirmed, x.EvidenceNotes, x.IsActive,
        x.VerifiedByMemberId, x.VerifiedUtc,
        x.IsActive && x.LicenceConfirmed && x.FitToDriveConfirmed && x.LicenceExpiresOn.HasValue && x.LicenceExpiresOn.Value >= localDate,
        DriverETag(x), x.CreatedUtc, x.UpdatedUtc);

    private static EventTravelVehicleDto ToVehicleDto(EventTravelVehicle x, DateOnly localDate) => new(
        x.Id, x.EventId, new(x.NameEn, x.NameZh), x.RegistrationReference, x.SeatCapacity,
        x.RegistrationConfirmed, x.RegistrationExpiresOn, x.WofConfirmed, x.WofExpiresOn,
        x.EvidenceNotes, x.IsActive, x.VerifiedByMemberId, x.VerifiedUtc,
        x.IsActive && x.RegistrationConfirmed && x.WofConfirmed &&
        x.RegistrationExpiresOn.HasValue && x.RegistrationExpiresOn.Value >= localDate &&
        x.WofExpiresOn.HasValue && x.WofExpiresOn.Value >= localDate,
        VehicleETag(x), x.CreatedUtc, x.UpdatedUtc);

    private static EventTravelJourneyDto ToJourneyDto(EventTravelJourney x)
    {
        var localDate = x.EventOccurrence.LocalDate;
        var stops = x.PickupStops.OrderBy(s => s.SortOrder).Select(s => new EventTravelPickupStopDto(
            s.Id, s.JourneyId, s.SortOrder, new(s.NameEn, s.NameZh), new(s.AddressEn, s.AddressZh), s.PickupUtc)).ToArray();
        var passengers = x.PassengerAssignments.Where(a => !a.EndedUtc.HasValue).OrderBy(a => a.PickupStop.SortOrder).ThenBy(a => a.Member.DisplayName)
            .Select(a => new EventTravelPassengerDto(a.Id, a.JourneyId, a.MemberId, a.Member.DisplayName ?? string.Empty, a.PickupStopId,
                new(a.PickupStop.NameEn, a.PickupStop.NameZh), a.PickupStop.PickupUtc, a.AssignedByMemberId, a.AssignedUtc)).ToArray();
        return new(x.Id, x.EventId, x.EventOccurrenceId, new(x.NameEn, x.NameZh), x.StartUtc, x.EndUtc,
            x.Driver is null ? null : ToDriverDto(x.Driver, localDate),
            x.Vehicle is null ? null : ToVehicleDto(x.Vehicle, localDate), stops, passengers, passengers.Length,
            x.ManifestConfirmed, x.Status, JourneyETag(x), x.CreatedUtc, x.UpdatedUtc);
    }

    private static AppResult<TTarget> ConvertFailure<TTarget, TSource>(AppResult<TSource> source) => source.Status switch
    {
        AppResultStatus.NotFound => AppResult<TTarget>.NotFound(source.Message!),
        AppResultStatus.Forbidden => AppResult<TTarget>.Forbidden(source.Message!),
        AppResultStatus.Conflict => AppResult<TTarget>.Conflict(source.Message!),
        AppResultStatus.PreconditionFailed => AppResult<TTarget>.PreconditionFailed(source.Message!),
        _ => AppResult<TTarget>.Validation(source.Message ?? "Request failed.")
    };
}
