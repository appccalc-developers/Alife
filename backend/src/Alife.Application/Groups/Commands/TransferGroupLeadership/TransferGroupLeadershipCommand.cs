using Alife.Application.Common.Models;
using Alife.Application.Groups.Dtos;
using MediatR;

namespace Alife.Application.Groups.Commands.TransferGroupLeadership;

public sealed record TransferGroupLeadershipCommand(Guid GroupId, Guid CurrentMemberId, Guid MemberId)
    : IRequest<AppResult<GroupActionResultDto>>;
