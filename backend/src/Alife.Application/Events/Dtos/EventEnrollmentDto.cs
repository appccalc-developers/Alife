namespace Alife.Application.Events.Dtos;

public sealed record EventEnrollmentDto(
    Guid Id,
    Guid GroupId,
    Guid EventId,
    Guid MemberId,
    string EnrollmentJson,
    DateTime CreatedUtc,
    DateTime UpdatedUtc);
