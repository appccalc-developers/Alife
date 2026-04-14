using Alife.Application.Common.Models;
using Alife.Application.Groups.Dtos;
using MediatR;

namespace Alife.Application.Groups.Commands.CloseGroup;

public sealed record CloseGroupCommand(Guid GroupId, Guid CurrentMemberId)
    : IRequest<AppResult<GroupActionResultDto>>;
