using Alife.Application.Common.Models;
using Alife.Application.Groups.Dtos;
using MediatR;

namespace Alife.Application.Groups.Commands.KickGroupMember;

public sealed record KickGroupMemberCommand(Guid GroupId, Guid CurrentMemberId, Guid MemberId)
    : IRequest<AppResult<GroupKickResultDto>>;
