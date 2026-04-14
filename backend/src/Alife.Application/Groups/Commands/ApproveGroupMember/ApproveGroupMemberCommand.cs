using Alife.Application.Common.Models;
using Alife.Application.Groups.Dtos;
using MediatR;

namespace Alife.Application.Groups.Commands.ApproveGroupMember;

public sealed record ApproveGroupMemberCommand(Guid GroupId, Guid CurrentMemberId, Guid MemberId)
    : IRequest<AppResult<GroupActionResultDto>>;
