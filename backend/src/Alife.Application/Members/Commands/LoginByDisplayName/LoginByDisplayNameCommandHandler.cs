using Alife.Application.Abstractions.Security;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Members.Dtos;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Members.Commands.LoginByDisplayName;

public sealed class LoginByDisplayNameCommandHandler(
    IAlifeDbContext dbContext,
    IJwtTokenService jwtTokenService)
    : IRequestHandler<LoginByDisplayNameCommand, AppResult<MemberActionResultDto>>
{
    public async Task<AppResult<MemberActionResultDto>> Handle(
        LoginByDisplayNameCommand request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.DisplayName))
        {
            return AppResult<MemberActionResultDto>.Validation("Display name is required.");
        }

        var displayName = request.DisplayName.Trim();

        var matches = await dbContext.Members
            .AsNoTracking()
            .Where(x => x.IsRegistered && x.DisplayName == displayName)
            .Take(2)
            .ToListAsync(cancellationToken);

        if (matches.Count == 0)
        {
            return AppResult<MemberActionResultDto>.NotFound("No registered member found with that display name.");
        }

        if (matches.Count > 1)
        {
            return AppResult<MemberActionResultDto>.Conflict("Multiple members share that display name. Please use LINE login instead.");
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
