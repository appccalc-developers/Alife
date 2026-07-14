using Alife.Application.Common.Models;
using Alife.Application.Groups.Dtos;
using MediatR;

namespace Alife.Application.Groups.Queries.GetGroupMemberProfile;

public sealed record GetGroupMemberProfileQuery(Guid GroupId, Guid CurrentMemberId, Guid TargetMemberId)
    : IRequest<AppResult<GroupMemberProfileDto>>;
