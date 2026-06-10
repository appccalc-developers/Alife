using Alife.Application.Common.Models;
using Alife.Application.Groups.Dtos;
using MediatR;

namespace Alife.Application.Groups.Commands.DeclineGroupInvite;

public sealed record DeclineGroupInviteCommand(Guid GroupId, Guid CurrentMemberId)
    : IRequest<AppResult<GroupActionResultDto>>;
