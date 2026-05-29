namespace Alife.Application.Members.Dtos;

public sealed record CurrentMemberDto(
    Guid Id,
    string? DisplayName,
    string? Sex,
    int? Age,
    string? Email,
    string? PhoneE164,
    string Language,
    bool IsGuest,
    bool IsRegistered,
    bool IsAdmin,
    IReadOnlyList<MemberMembershipDto> Memberships);
