using Alife.Application.Abstractions.Security;
using Alife.Application.Admin;
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

        var admin = await dbContext.Members
            .Include(x => x.PlatformRoles)
            .ThenInclude(x => x.Role)
            .Where(x => x.PlatformRoles.Any(role =>
                    role.RevokedUtc == null &&
                    (role.Role.Code == "superadmin" ||
                     role.Role.PermissionsJson.Contains(AdminPermissionCatalog.AccessAdmin))))
            .OrderByDescending(x => x.PlatformRoles.Max(role => (int?)role.Role.Level) ?? 0)
            .FirstOrDefaultAsync(cancellationToken);
        if (admin is null)
        {
            return AppResult<AuthSessionDto>.NotFound("No admin member seeded.");
        }

        var (token, expiresUtc) = jwtTokenService.CreateToken(admin, isGuest: false);
        return AppResult<AuthSessionDto>.Success(new AuthSessionDto(token, expiresUtc, false, true));
    }
}
