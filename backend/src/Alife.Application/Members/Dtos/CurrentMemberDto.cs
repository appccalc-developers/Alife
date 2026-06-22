namespace Alife.Application.Members.Dtos;

public sealed record CurrentMemberDto(
    Guid Id,
    string? DisplayName,
    string? Sex,
    int? Age,
    string? Email,
    string? PhoneE164,
    bool IsGuest,
    bool IsRegistered,
    bool IsAdmin,
    string PlatformRole,
    IReadOnlyList<MemberMembershipDto> Memberships);
