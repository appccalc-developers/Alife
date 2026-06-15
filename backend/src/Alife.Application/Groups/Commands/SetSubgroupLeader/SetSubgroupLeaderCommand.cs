using Alife.Application.Common.Models;
using Alife.Application.Groups.Dtos;
using MediatR;

namespace Alife.Application.Groups.Commands.SetSubgroupLeader;

public sealed record SetSubgroupLeaderCommand(
    Guid ParentGroupId,
    Guid SubgroupId,
    Guid CurrentMemberId,
    Guid MemberId)
    : IRequest<AppResult<GroupActionResultDto>>;
