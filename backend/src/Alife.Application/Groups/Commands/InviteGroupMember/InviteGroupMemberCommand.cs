using Alife.Application.Common.Models;
using Alife.Application.Groups.Dtos;
using MediatR;

namespace Alife.Application.Groups.Commands.InviteGroupMember;

public sealed record InviteGroupMemberCommand(Guid GroupId, Guid CurrentMemberId, string TargetPhoneE164)
    : IRequest<AppResult<GroupActionResultDto>>;
