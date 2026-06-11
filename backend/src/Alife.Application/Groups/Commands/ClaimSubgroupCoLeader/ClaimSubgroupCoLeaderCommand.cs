using Alife.Application.Common.Models;
using Alife.Application.Groups.Dtos;
using MediatR;

namespace Alife.Application.Groups.Commands.ClaimSubgroupCoLeader;

public sealed record ClaimSubgroupCoLeaderCommand(Guid ParentGroupId, Guid SubgroupId, Guid CurrentMemberId)
    : IRequest<AppResult<GroupActionResultDto>>;
