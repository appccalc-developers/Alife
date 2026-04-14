using Alife.Application.Common.Models;
using Alife.Application.Groups.Dtos;
using MediatR;

namespace Alife.Application.Groups.Commands.RejectGroupMember;

public sealed record RejectGroupMemberCommand(Guid GroupId, Guid CurrentMemberId, Guid MemberId)
    : IRequest<AppResult<GroupActionResultDto>>;
