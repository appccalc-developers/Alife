namespace Alife.Application.Groups.Dtos;

public sealed record GroupMembershipDto(
    Guid MemberId,
    string? DisplayName,
    string Status,
    string Role,
    string PlatformRole,
    IReadOnlyList<string> PlatformRoles,
    DateTime CreatedUtc,
    DateTime UpdatedUtc);
