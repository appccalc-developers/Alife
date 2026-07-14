using Alife.Application.Common.Models;
using Alife.Application.Groups.Dtos;
using MediatR;

namespace Alife.Application.Groups.Commands.UpdateGroupMemberProfile;

public sealed record UpdateGroupMemberProfileCommand(
    Guid GroupId,
    Guid CurrentMemberId,
    Guid TargetMemberId,
    string? DisplayName,
    string? Email,
    string? PhoneE164)
    : IRequest<AppResult<GroupMemberProfileDto>>;
