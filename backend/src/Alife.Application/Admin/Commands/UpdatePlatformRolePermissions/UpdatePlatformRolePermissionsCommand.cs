using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Admin.Commands.UpdatePlatformRolePermissions;

public sealed record UpdatePlatformRolePermissionsCommand(
    Guid CurrentMemberId,
    int RoleId,
    IReadOnlyList<string> PermissionCodes) : IRequest<AppResult<AdminPlatformRoleDto>>;
