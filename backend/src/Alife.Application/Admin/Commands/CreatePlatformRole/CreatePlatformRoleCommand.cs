using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Admin.Commands.CreatePlatformRole;

public sealed record CreatePlatformRoleCommand(
    Guid CurrentMemberId,
    string Code,
    string NameEn,
    string NameZh,
    IReadOnlyList<string> PermissionCodes) : IRequest<AppResult<AdminPlatformRoleDto>>;
