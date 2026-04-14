using Alife.Application.Abstractions.Security;
using Alife.Application.Auth.Dtos;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Auth.Commands.CreateDevAdminSession;

public sealed class CreateDevAdminSessionCommandHandler(
    IAlifeDbContext dbContext,
    IJwtTokenService jwtTokenService)
    : IRequestHandler<CreateDevAdminSessionCommand, AppResult<AuthSessionDto>>
{
    public async Task<AppResult<AuthSessionDto>> Handle(CreateDevAdminSessionCommand request, CancellationToken cancellationToken)
    {
        if (!request.IsDevelopment)
        {
            return AppResult<AuthSessionDto>.NotFound("Endpoint is only available in development.");
        }

        var admin = await dbContext.Members.FirstOrDefaultAsync(x => x.IsAdmin, cancellationToken);
        if (admin is null)
        {
            return AppResult<AuthSessionDto>.NotFound("No admin member seeded.");
        }

        var (token, expiresUtc) = jwtTokenService.CreateToken(admin, isGuest: false);
        return AppResult<AuthSessionDto>.Success(new AuthSessionDto(token, expiresUtc, false, true));
    }
}
