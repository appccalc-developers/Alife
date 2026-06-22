namespace Alife.Application.Admin.Dtos;

public sealed record AdminSelfDiagnosticDto(
    Guid CurrentMemberId,
    string? DisplayName,
    bool IsRegistered,
    bool LegacyIsAdmin,
    string PlatformRole,
    IReadOnlyList<string> PlatformRoles,
    int PlatformRoleLevel,
    bool CanAccessAdmin);
