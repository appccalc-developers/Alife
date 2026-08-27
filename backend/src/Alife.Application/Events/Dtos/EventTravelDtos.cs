using Alife.Domain.Enums;

namespace Alife.Application.Events.Dtos;

public sealed record EventTravelMemberOptionDto(Guid MemberId, string DisplayName);

public sealed record EventTravelDriverDto(
    Guid Id,
    Guid EventId,
    Guid MemberId,
    string MemberDisplayName,
    string LicenceClass,
    DateOnly? LicenceExpiresOn,
    bool LicenceConfirmed,
    bool FitToDriveConfirmed,
    string EvidenceNotes,
    bool IsActive,
    Guid VerifiedByMemberId,
    DateTime VerifiedUtc,
    bool IsEligible,
    string ETag,
    DateTime CreatedUtc,
    DateTime UpdatedUtc);

public sealed record SaveEventTravelDriverRequest(
    Guid MemberId,
    string LicenceClass,
    DateOnly? LicenceExpiresOn,
    bool LicenceConfirmed,
    bool FitToDriveConfirmed,
    string? EvidenceNotes,
    bool IsActive = true);

public sealed record EventTravelVehicleDto(
    Guid Id,
    Guid EventId,
    LocalizedTextDto Name,
    string RegistrationReference,
    int SeatCapacity,
    bool RegistrationConfirmed,
    DateOnly? RegistrationExpiresOn,
    bool WofConfirmed,
    DateOnly? WofExpiresOn,
    string EvidenceNotes,
    bool IsActive,
    Guid VerifiedByMemberId,
    DateTime VerifiedUtc,
    bool EvidenceComplete,
    string ETag,
    DateTime CreatedUtc,
    DateTime UpdatedUtc);

public sealed record SaveEventTravelVehicleRequest(
    LocalizedTextDto Name,
    string RegistrationReference,
    int SeatCapacity,
    bool RegistrationConfirmed,
    DateOnly? RegistrationExpiresOn,
    bool WofConfirmed,
    DateOnly? WofExpiresOn,
    string? EvidenceNotes,
    bool IsActive = true);

public sealed record EventTravelPickupStopDto(
    Guid Id,
    Guid JourneyId,
    int SortOrder,
    LocalizedTextDto Name,
    LocalizedTextDto Address,
    DateTime PickupUtc);

public sealed record SaveEventTravelPickupStopRequest(
    int SortOrder,
    LocalizedTextDto Name,
    LocalizedTextDto? Address,
    DateTime PickupUtc);

public sealed record EventTravelPassengerDto(
    Guid Id,
    Guid JourneyId,
    Guid MemberId,
    string MemberDisplayName,
    Guid PickupStopId,
    LocalizedTextDto PickupStopName,
    DateTime PickupUtc,
    Guid AssignedByMemberId,
    DateTime AssignedUtc);

public sealed record AssignEventTravelPassengerRequest(Guid MemberId, Guid PickupStopId);

public sealed record EventTravelJourneyDto(
    Guid Id,
    Guid EventId,
    Guid EventOccurrenceId,
    LocalizedTextDto Name,
    DateTime StartUtc,
    DateTime EndUtc,
    EventTravelDriverDto? Driver,
    EventTravelVehicleDto? Vehicle,
    IReadOnlyList<EventTravelPickupStopDto> PickupStops,
    IReadOnlyList<EventTravelPassengerDto> PassengerManifest,
    int PassengerCount,
    bool ManifestConfirmed,
    EventTravelJourneyStatus Status,
    string ETag,
    DateTime CreatedUtc,
    DateTime UpdatedUtc);

public sealed record CreateEventTravelJourneyRequest(
    Guid EventOccurrenceId,
    LocalizedTextDto Name,
    DateTime StartUtc,
    DateTime EndUtc,
    Guid? DriverId,
    Guid? VehicleId);

public sealed record UpdateEventTravelJourneyRequest(
    LocalizedTextDto Name,
    DateTime StartUtc,
    DateTime EndUtc,
    Guid? DriverId,
    Guid? VehicleId,
    bool ManifestConfirmed,
    EventTravelJourneyStatus Status);

public sealed record EventTravelRamEvidenceDto(
    bool? TransportRequired,
    bool? LicensedDriverConfirmed,
    bool? VehicleRegistrationConfirmed,
    bool? VehicleWofConfirmed,
    EventRamStatus Status,
    bool ChecksComplete);

public sealed record EventTravelReadinessDto(
    bool TransportFactsConfirmed,
    bool DriversAndVehiclesQualified,
    bool PassengerManifestsComplete,
    bool RamTransportChecksComplete,
    IReadOnlyList<LocalizedTextDto> Blockers);

public sealed record EventTravelWorkspaceDto(
    Guid EventId,
    IReadOnlyList<EventOccurrenceDto> Occurrences,
    IReadOnlyList<EventTravelMemberOptionDto> EligibleMembers,
    IReadOnlyList<EventTravelDriverDto> Drivers,
    IReadOnlyList<EventTravelVehicleDto> Vehicles,
    IReadOnlyList<EventTravelJourneyDto> Journeys,
    EventTravelRamEvidenceDto RamEvidence,
    EventTravelReadinessDto Readiness,
    bool CanManage,
    string DataClassification);

public sealed record EventTravelMyJourneyDto(
    Guid JourneyId,
    Guid EventOccurrenceId,
    LocalizedTextDto Name,
    DateTime StartUtc,
    DateTime EndUtc,
    string? DriverDisplayName,
    LocalizedTextDto? VehicleName,
    string? VehicleRegistrationReference,
    LocalizedTextDto? PickupStopName,
    LocalizedTextDto? PickupStopAddress,
    DateTime? PickupUtc,
    EventTravelJourneyStatus Status);

public sealed record EventTravelMyJourneysDto(
    Guid EventId,
    IReadOnlyList<EventTravelMyJourneyDto> Journeys,
    string DataClassification);
