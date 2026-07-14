using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Admin.Commands.UpdateMemberProfile;

public sealed record UpdateMemberProfileCommand(
    Guid CurrentMemberId,
    Guid TargetMemberId,
    string? DisplayName,
    string? Email,
    string? PhoneE164) : IRequest<AppResult<AdminMemberDto>>;
