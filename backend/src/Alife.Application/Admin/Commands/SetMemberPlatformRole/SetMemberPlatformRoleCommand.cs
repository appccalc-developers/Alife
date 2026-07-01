using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Admin.Commands.SetMemberPlatformRole;

public sealed record SetMemberPlatformRoleCommand(Guid CurrentMemberId, Guid TargetMemberId, IReadOnlyList<string> RoleCodes)
    : IRequest<AppResult<AdminMemberDto>>;
