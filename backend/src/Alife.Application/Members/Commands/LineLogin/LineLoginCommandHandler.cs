using Alife.Application.Abstractions.Integrations;
using Alife.Application.Abstractions.Security;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Members.Dtos;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Members.Commands.LineLogin;

public sealed class LineLoginCommandHandler(
    IAlifeDbContext dbContext,
    ILineLoginService lineLoginService,
    IJwtTokenService jwtTokenService)
    : IRequestHandler<LineLoginCommand, AppResult<MemberActionResultDto>>
{
    public async Task<AppResult<MemberActionResultDto>> Handle(
        LineLoginCommand request,
        CancellationToken cancellationToken)
    {
        var lineResult = await lineLoginService.ExchangeCodeAsync(request.Code, cancellationToken);
        if (lineResult is null)
        {
            return AppResult<MemberActionResultDto>.Validation("LINE login failed. Could not exchange authorization code.");
        }

        var lineUID = lineResult.LineUID;

        var member = request.CurrentMemberId is Guid currentMemberId
            ? await dbContext.Members.FirstOrDefaultAsync(x => x.Id == currentMemberId, cancellationToken)
            : null;

        var memberId = member?.Id;

        var existingRegisteredMember = await dbContext.Members
            .AsNoTracking()
            .FirstOrDefaultAsync(
                x => x.IsRegistered && x.LineUID == lineUID && (!memberId.HasValue || x.Id != memberId.Value),
                cancellationToken);

        if (member?.IsRegistered == true && existingRegisteredMember is not null)
        {
            return AppResult<MemberActionResultDto>.Conflict("LINE account already registered to another member.");
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
            member.LineUID = lineUID;
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        else
        {
            var onboardingToken = jwtTokenService.CreateVerifiedLineToken(lineUID, lineResult.DisplayName, lineResult.Email);
            token = onboardingToken.Token;
            expiresUtc = onboardingToken.ExpiresUtc;
        }

        return AppResult<MemberActionResultDto>.Success(new MemberActionResultDto(
            true,
            DisplayName: lineResult.DisplayName,
            Email: lineResult.Email,
            IsRegistered: false,
            Token: token,
            ExpiresUtc: expiresUtc));
    }
}
