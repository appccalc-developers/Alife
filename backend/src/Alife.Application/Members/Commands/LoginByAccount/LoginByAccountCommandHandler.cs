using Alife.Application.Abstractions.Security;
using Alife.Application.Common;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Members.Dtos;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Members.Commands.LoginByAccount;

public sealed class LoginByAccountCommandHandler(
    IAlifeDbContext dbContext,
    IJwtTokenService jwtTokenService)
    : IRequestHandler<LoginByAccountCommand, AppResult<MemberActionResultDto>>
{
    public async Task<AppResult<MemberActionResultDto>> Handle(
        LoginByAccountCommand request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Account))
        {
            return AppResult<MemberActionResultDto>.Validation("Account is required.");
        }

        var account = request.Account.Trim();
        var phoneCandidates = SupportedPhoneNumber.GetE164Candidates(account);

        var matches = await dbContext.Members
            .AsNoTracking()
            .Include(x => x.PlatformRoles)
            .ThenInclude(x => x.Role)
            .Where(x => x.IsRegistered &&
                        (x.DisplayName == account ||
                         x.PhoneE164 == account ||
                         phoneCandidates.Contains(x.PhoneE164!)))
            .Take(2)
            .ToListAsync(cancellationToken);

        if (matches.Count == 0)
        {
            return AppResult<MemberActionResultDto>.NotFound("No registered member found with that account.");
        }

        if (matches.Count > 1)
        {
            return AppResult<MemberActionResultDto>.Conflict("Multiple members match that account. Please use LINE login instead.");
        }

        var member = matches[0];
        var (token, expiresUtc) = jwtTokenService.CreateToken(member, isGuest: false);

        return AppResult<MemberActionResultDto>.Success(new MemberActionResultDto(
            Ok: true,
            DisplayName: member.DisplayName,
            Sex: member.Sex,
            Age: member.Age,
            Email: member.Email,
            IsRegistered: true,
            Token: token,
            ExpiresUtc: expiresUtc));
    }
}
