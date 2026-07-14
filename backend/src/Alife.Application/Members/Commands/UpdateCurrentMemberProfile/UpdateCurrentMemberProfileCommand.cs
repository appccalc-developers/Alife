using Alife.Application.Common.Models;
using Alife.Application.Members.Dtos;
using MediatR;

namespace Alife.Application.Members.Commands.UpdateCurrentMemberProfile;

public sealed record UpdateCurrentMemberProfileCommand(
    Guid CurrentMemberId,
    string? DisplayName,
    string? Email,
    string? PhoneE164) : IRequest<AppResult<MemberActionResultDto>>;
