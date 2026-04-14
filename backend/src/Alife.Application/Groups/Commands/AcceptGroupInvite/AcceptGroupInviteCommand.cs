using Alife.Application.Common.Models;
using Alife.Application.Groups.Dtos;
using MediatR;

namespace Alife.Application.Groups.Commands.AcceptGroupInvite;

public sealed record AcceptGroupInviteCommand(Guid GroupId, Guid CurrentMemberId)
    : IRequest<AppResult<GroupActionResultDto>>;
