using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Admin.Commands.DeletePlatformRole;

public sealed record DeletePlatformRoleCommand(Guid CurrentMemberId, int RoleId)
    : IRequest<AppResult<AdminActionResultDto>>;
