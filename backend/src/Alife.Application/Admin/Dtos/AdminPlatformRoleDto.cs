namespace Alife.Application.Admin.Dtos;

public sealed record AdminFeaturePermissionDto(string Code, IReadOnlyDictionary<string, string> Name);

public sealed record AdminPlatformRoleDto(
    int Id,
    string Code,
    IReadOnlyDictionary<string, string> Name,
    int Level,
    IReadOnlyList<string> Permissions,
    IReadOnlyList<AdminFeaturePermissionDto> AvailablePermissions,
    bool CanEditPermissions,
    bool IsSystem,
    bool CanDelete,
    int AssignedMemberCount);
