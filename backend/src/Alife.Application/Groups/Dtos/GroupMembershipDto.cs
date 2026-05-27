namespace Alife.Application.Groups.Dtos;

public sealed record GroupMembershipDto(
    Guid MemberId,
    string? DisplayName,
    string Status,
    string Role,
    DateTime CreatedUtc,
    DateTime UpdatedUtc);
