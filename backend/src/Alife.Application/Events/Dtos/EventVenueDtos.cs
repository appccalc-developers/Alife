using Alife.Domain.Enums;

namespace Alife.Application.Events.Dtos;

public sealed record EventVenueDto(
    Guid Id,
    Guid ManagingGroupId,
    LocalizedTextDto Name,
    LocalizedTextDto Address,
    int Capacity,
    bool IsActive,
    string ETag,
    DateTime CreatedUtc,
    DateTime UpdatedUtc);

public sealed record EventVenueCatalogueDto(
    Guid ManagingGroupId,
    IReadOnlyList<EventVenueDto> Venues,
    bool CanManage);

public sealed record SaveEventVenueRequest(
    LocalizedTextDto Name,
    LocalizedTextDto? Address,
    int Capacity,
    bool IsActive = true);

public sealed record EventVenueReservationDto(
    Guid Id,
    Guid VenueId,
    Guid EventId,
    Guid? EventOccurrenceId,
    LocalizedTextDto VenueName,
    int VenueCapacity,
    DateTime StartUtc,
    DateTime EndUtc,
    int RequiredCapacity,
    EventVenueReservationStatus Status,
    Guid ReservedByMemberId,
    Guid? ReleasedByMemberId,
    DateTime? ReleasedUtc,
    string ETag,
    DateTime CreatedUtc,
    DateTime UpdatedUtc);

public sealed record ReserveEventVenueRequest(
    Guid VenueId,
    Guid? EventOccurrenceId,
    DateTime StartUtc,
    DateTime EndUtc,
    int RequiredCapacity);

public sealed record EventVenueConflictDto(
    Guid VenueId,
    LocalizedTextDto VenueName,
    DateTime StartUtc,
    DateTime EndUtc);

public sealed record EventVenueReadinessDto(
    bool CapacitySufficient,
    bool BookingsConfirmed,
    bool ConflictsResolved,
    IReadOnlyList<LocalizedTextDto> Blockers);

public sealed record EventVenueWorkspaceDto(
    Guid EventId,
    Guid ManagingGroupId,
    IReadOnlyList<EventVenueDto> Venues,
    IReadOnlyList<EventVenueReservationDto> Reservations,
    IReadOnlyList<EventVenueConflictDto> Conflicts,
    EventVenueReadinessDto Readiness,
    bool CanManage,
    bool CanManageCatalogue,
    bool LegacySessionPlacePreserved);
