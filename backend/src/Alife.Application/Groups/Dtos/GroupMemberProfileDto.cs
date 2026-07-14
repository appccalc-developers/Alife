namespace Alife.Application.Groups.Dtos;

public sealed record GroupMemberProfileDto(
    Guid MemberId,
    string? DisplayName,
    string? Email,
    string? PhoneE164);
