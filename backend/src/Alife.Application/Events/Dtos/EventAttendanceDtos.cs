namespace Alife.Application.Events.Dtos;

public sealed record EventAttendanceOccurrenceDto(
    Guid Id,
    WorkflowTextDto Name,
    DateTime StartUtc,
    DateTime EndUtc,
    string TimeZoneId,
    bool CanRecord,
    int AttendedUnits);

public sealed record EventAttendanceEnrollmentDto(
    Guid Id,
    string ApplicantName,
    int ReservedUnits);

public sealed record EventAttendanceRecordDto(
    Guid Id,
    Guid EventOccurrenceId,
    Guid? EventEnrollmentId,
    int AttendedUnits,
    string Notes,
    DateTime UpdatedUtc);

public sealed record EventAttendanceWorkspaceDto(
    Guid EventId,
    Guid GroupId,
    WorkflowTextDto Title,
    string CapacityUnit,
    IReadOnlyList<EventAttendanceOccurrenceDto> Occurrences,
    IReadOnlyList<EventAttendanceEnrollmentDto> Enrollments,
    IReadOnlyList<EventAttendanceRecordDto> Records,
    int TotalAttendedUnits,
    int TotalRegisteredUnits);
