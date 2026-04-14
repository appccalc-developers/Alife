using Alife.Application.Common.Models;
using Alife.Application.Groups.Dtos;
using MediatR;

namespace Alife.Application.Groups.Commands.JoinGroup;

public sealed record JoinGroupCommand(Guid GroupId, Guid CurrentMemberId)
    : IRequest<AppResult<GroupStatusResultDto>>;
