using Alife.Application.Abstractions.Integrations;
using Alife.Application.Common.Models;
using Alife.Application.Members.Dtos;
using MediatR;

namespace Alife.Application.Members.Commands.StartPhoneVerification;

public sealed class StartPhoneVerificationCommandHandler(ITwilioVerifyService twilioVerifyService)
    : IRequestHandler<StartPhoneVerificationCommand, AppResult<MemberActionResultDto>>
{
    public async Task<AppResult<MemberActionResultDto>> Handle(
        StartPhoneVerificationCommand request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.PhoneE164))
        {
            return AppResult<MemberActionResultDto>.Validation("phoneE164 is required.");
        }

        var result = await twilioVerifyService.StartVerificationAsync(request.PhoneE164, cancellationToken);
        return result.Status switch
        {
            AppResultStatus.Success when result.Value == true
                => AppResult<MemberActionResultDto>.Success(new MemberActionResultDto(true)),
            AppResultStatus.ValidationError
                => AppResult<MemberActionResultDto>.Validation(result.Message ?? "Unable to start verification."),
            AppResultStatus.Forbidden
                => AppResult<MemberActionResultDto>.Forbidden(result.Message ?? "Verification service is unavailable."),
            AppResultStatus.Conflict
                => AppResult<MemberActionResultDto>.Conflict(result.Message ?? "Unable to start verification."),
            AppResultStatus.NotFound
                => AppResult<MemberActionResultDto>.NotFound(result.Message ?? "Verification service configuration not found."),
            _
                => AppResult<MemberActionResultDto>.Validation(result.Message ?? "Unable to start verification.")
        };
    }
}
