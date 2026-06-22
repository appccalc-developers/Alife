namespace Alife.Application.Admin.Dtos;

public sealed record AdminMemberDto(
    Guid Id,
    string? DisplayName,
    string? Email,
    string? PhoneE164,
    bool IsRegistered,
    bool LegacyIsAdmin,
    string PlatformRole,
    IReadOnlyList<string> PlatformRoles,
    int ApprovedGroupCount,
    int PendingGroupCount);
