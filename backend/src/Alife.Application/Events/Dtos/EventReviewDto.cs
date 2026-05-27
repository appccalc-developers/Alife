namespace Alife.Application.Events.Dtos;

public sealed record EventReviewDto(
    Guid Id,
    Guid GroupId,
    Guid EventId,
    Guid MemberId,
    string ReviewJson,
    DateTime CreatedUtc,
    DateTime UpdatedUtc);
