using Alife.Application.Common.Models;
using Alife.Application.Members.Dtos;
using MediatR;

namespace Alife.Application.Members.Commands.StartPhoneVerification;

public sealed record StartPhoneVerificationCommand(string PhoneE164) : IRequest<AppResult<MemberActionResultDto>>;
