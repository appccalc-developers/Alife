using Alife.Application.Common.Models;
using Alife.Application.Groups.Dtos;
using MediatR;

namespace Alife.Application.Groups.Commands.InviteGroupMemberById;

public sealed record InviteGroupMemberByIdCommand(Guid GroupId, Guid CurrentMemberId, Guid TargetMemberId)
    : IRequest<AppResult<GroupActionResultDto>>;
