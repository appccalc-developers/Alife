using Alife.Application.Common.Models;
using Alife.Application.Groups.Dtos;
using MediatR;

namespace Alife.Application.Groups.Commands.SetGroupCoLeader;

public sealed record SetGroupCoLeaderCommand(Guid GroupId, Guid CurrentMemberId, Guid MemberId, bool IsCoLeader)
    : IRequest<AppResult<GroupActionResultDto>>;
