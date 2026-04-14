using Alife.Application.Abstractions.Security;
using Alife.Application.Auth.Dtos;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Auth.Commands.CreateGuestSession;

public sealed class CreateGuestSessionCommandHandler(
    IAlifeDbContext dbContext,
    IJwtTokenService jwtTokenService)
    : IRequestHandler<CreateGuestSessionCommand, AppResult<AuthSessionDto>>
{
    public async Task<AppResult<AuthSessionDto>> Handle(CreateGuestSessionCommand request, CancellationToken cancellationToken)
    {
        var member = new Member
        {
            Id = Guid.NewGuid(),
            IsRegistered = false,
            IsAdmin = false,
            CreatedUtc = DateTime.UtcNow
        };

        // Guest auth should remain available even if member persistence is temporarily failing.
        dbContext.Members.Add(member);
        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException) when (!cancellationToken.IsCancellationRequested)
        {
        }

        var (token, expiresUtc) = jwtTokenService.CreateToken(member, isGuest: true);
        return AppResult<AuthSessionDto>.Success(new AuthSessionDto(token, expiresUtc, true, false));
    }
}
