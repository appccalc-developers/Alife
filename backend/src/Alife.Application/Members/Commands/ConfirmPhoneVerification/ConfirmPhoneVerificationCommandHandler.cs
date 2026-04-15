using Alife.Application.Abstractions.Integrations;
using Alife.Application.Abstractions.Security;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Members.Dtos;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Members.Commands.ConfirmPhoneVerification;

public sealed class ConfirmPhoneVerificationCommandHandler(
    IAlifeDbContext dbContext,
    ITwilioVerifyService twilioVerifyService,
    IJwtTokenService jwtTokenService)
    : IRequestHandler<ConfirmPhoneVerificationCommand, AppResult<MemberActionResultDto>>
{
    public async Task<AppResult<MemberActionResultDto>> Handle(
        ConfirmPhoneVerificationCommand request,
        CancellationToken cancellationToken)
    {
        var verificationResult = await twilioVerifyService.ConfirmCodeAsync(request.PhoneE164, request.Code, cancellationToken);
        if (verificationResult.Status != AppResultStatus.Success || verificationResult.Value != true)
        {
            return verificationResult.Status switch
            {
                AppResultStatus.Forbidden
                    => AppResult<MemberActionResultDto>.Forbidden(verificationResult.Message ?? "Verification service is unavailable."),
                AppResultStatus.Conflict
                    => AppResult<MemberActionResultDto>.Conflict(verificationResult.Message ?? "Invalid code."),
                AppResultStatus.NotFound
                    => AppResult<MemberActionResultDto>.NotFound(verificationResult.Message ?? "Verification service configuration not found."),
                _
                    => AppResult<MemberActionResultDto>.Validation(verificationResult.Message ?? "Invalid code.")
            };
        }

        var member = request.CurrentMemberId is Guid currentMemberId
            ? await dbContext.Members.FirstOrDefaultAsync(x => x.Id == currentMemberId, cancellationToken)
            : null;

        var memberId = member?.Id;

        var existingRegisteredMember = await dbContext.Members
            .AsNoTracking()
            .FirstOrDefaultAsync(
                x => x.IsRegistered && x.PhoneE164 == request.PhoneE164 && (!memberId.HasValue || x.Id != memberId.Value),
                cancellationToken);

        if (member?.IsRegistered == true && existingRegisteredMember is not null)
        {
            return AppResult<MemberActionResultDto>.Conflict("Phone already registered.");
        }

        if (existingRegisteredMember is not null)
        {
            var signInToken = jwtTokenService.CreateToken(existingRegisteredMember, isGuest: false);
            return AppResult<MemberActionResultDto>.Success(new MemberActionResultDto(
                true,
                DisplayName: existingRegisteredMember.DisplayName,
                Sex: existingRegisteredMember.Sex,
                Age: existingRegisteredMember.Age,
                Email: existingRegisteredMember.Email,
                IsRegistered: true,
                Token: signInToken.Token,
                ExpiresUtc: signInToken.ExpiresUtc));
        }

        string? token = null;
        DateTime? expiresUtc = null;

        if (member is not null)
        {
            member.PhoneE164 = request.PhoneE164;
            member.PhoneVerifiedUtc = DateTime.UtcNow;
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        else
        {
            var onboardingToken = jwtTokenService.CreateVerifiedPhoneToken(request.PhoneE164);
            token = onboardingToken.Token;
            expiresUtc = onboardingToken.ExpiresUtc;
        }

        return AppResult<MemberActionResultDto>.Success(new MemberActionResultDto(
            true,
            IsRegistered: false,
            Token: token,
            ExpiresUtc: expiresUtc));
    }
}
