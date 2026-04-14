using Alife.Application.Common.Models;
using Alife.Application.Members.Dtos;
using MediatR;

namespace Alife.Application.Members.Commands.ConfirmPhoneVerification;

public sealed record ConfirmPhoneVerificationCommand(Guid CurrentMemberId, string PhoneE164, string Code)
    : IRequest<AppResult<MemberActionResultDto>>;
