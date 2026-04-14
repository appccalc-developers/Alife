using Alife.Application.Abstractions.Integrations;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Members.Dtos;
using Alife.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Members.Commands.ConfirmPhoneVerification;

public sealed class ConfirmPhoneVerificationCommandHandler(
    IAlifeDbContext dbContext,
    ITwilioVerifyService twilioVerifyService)
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

        var member = await dbContext.Members.FirstOrDefaultAsync(x => x.Id == request.CurrentMemberId, cancellationToken);
        if (member is null)
        {
            member = new Member
            {
                Id = request.CurrentMemberId,
                IsRegistered = false,
                IsAdmin = false,
                CreatedUtc = DateTime.UtcNow
            };

            dbContext.Members.Add(member);
        }

        if (member.IsRegistered)
        {
            var alreadyRegistered = await dbContext.Members.AnyAsync(
                x => x.Id != request.CurrentMemberId && x.IsRegistered && x.PhoneE164 == request.PhoneE164,
                cancellationToken);

            if (alreadyRegistered)
            {
                return AppResult<MemberActionResultDto>.Conflict("Phone already registered.");
            }
        }

        var existingRegisteredMember = await dbContext.Members
            .AsNoTracking()
            .FirstOrDefaultAsync(
                x => x.Id != request.CurrentMemberId && x.IsRegistered && x.PhoneE164 == request.PhoneE164,
                cancellationToken);

        member.PhoneE164 = request.PhoneE164;
        member.PhoneVerifiedUtc = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);
        return AppResult<MemberActionResultDto>.Success(new MemberActionResultDto(
            true,
            DisplayName: existingRegisteredMember?.DisplayName,
            Sex: existingRegisteredMember?.Sex,
            Age: existingRegisteredMember?.Age,
            Email: existingRegisteredMember?.Email,
            IsRegistered: existingRegisteredMember?.IsRegistered ?? false));
    }
}
