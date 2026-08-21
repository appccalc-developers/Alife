using Alife.Application.Common.Models;
using Alife.Application.Groups.Dtos;
using MediatR;

namespace Alife.Application.Groups.Commands.AppointGroupLeader;

public sealed record AppointGroupLeaderCommand(Guid GroupId, Guid CurrentMemberId, Guid MemberId)
    : IRequest<AppResult<GroupActionResultDto>>;
