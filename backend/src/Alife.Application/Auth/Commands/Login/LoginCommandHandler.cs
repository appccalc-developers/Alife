using Alife.Application.Abstractions.Security;
using Alife.Application.Auth.Dtos;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Auth.Commands.Login;

public sealed class LoginCommandHandler(
    IAlifeDbContext dbContext,
    IJwtTokenService jwtTokenService)
    : IRequestHandler<LoginCommand, AppResult<AuthSessionDto>>
{
    public async Task<AppResult<AuthSessionDto>> Handle(LoginCommand request, CancellationToken cancellationToken)
    {
        var member = await dbContext.Members
            .Include(x => x.PlatformRoles)
            .ThenInclude(x => x.Role)
            .FirstOrDefaultAsync(x => x.Id == request.CurrentMemberId, cancellationToken);
        if (member is null || !member.IsRegistered)
        {
            return AppResult<AuthSessionDto>.Validation("Member must complete registration first.");
        }

        var (token, expiresUtc) = jwtTokenService.CreateToken(member, isGuest: false);
        var isAdmin = member.PlatformRoles.Any(role =>
            role.RevokedUtc is null &&
            (role.RoleId == 10 || role.RoleId == 100));
        return AppResult<AuthSessionDto>.Success(new AuthSessionDto(token, expiresUtc, false, isAdmin));
    }
}
