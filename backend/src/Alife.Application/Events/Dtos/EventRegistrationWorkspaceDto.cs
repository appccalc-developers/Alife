namespace Alife.Application.Events.Dtos;

public sealed record EventRegistrationEntryDto(
    Guid EnrollmentId,
    Guid MemberId,
    string ApplicantName,
    int ReservedUnits,
    DateTime UpdatedUtc);

public sealed record EventRegistrationWorkspaceDto(
    Guid EventId,
    Guid GroupId,
    string TitleEn,
    string TitleZh,
    DateTime StartUtc,
    int MaxCapacity,
    string CapacityUnit,
    DateTime? RegistrationDeadlineUtc,
    string Status,
    string BlockingReason,
    int EnrollmentCount,
    int ReservedUnits,
    int RemainingUnits,
    IReadOnlyList<EventRegistrationEntryDto> Registrations);
