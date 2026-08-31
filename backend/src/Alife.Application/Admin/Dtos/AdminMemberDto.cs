using Alife.Domain.Enums;

namespace Alife.Application.Admin.Dtos;

public sealed record AdminMemberGroupDto(
    Guid Id,
    string NameJson,
    MembershipStatus Status,
    MembershipRole Role);

public sealed record AdminMemberDto(
    Guid Id,
    string? DisplayName,
    string? Salutation,
    string? Sex,
    string? Email,
    string? PhoneE164,
    bool IsRegistered,
    bool NeedsPasskey,
    bool LegacyIsAdmin,
    DateTime CreatedUtc,
    DateTime UpdatedUtc,
    string PlatformRole,
    IReadOnlyList<string> PlatformRoles,
    int ApprovedGroupCount,
    int PendingGroupCount,
    MembershipStatus? ChurchMembershipStatus,
    MembershipRole? ChurchMembershipRole,
    bool IsGroupLeader,
    IReadOnlyList<AdminMemberGroupDto> Groups);
