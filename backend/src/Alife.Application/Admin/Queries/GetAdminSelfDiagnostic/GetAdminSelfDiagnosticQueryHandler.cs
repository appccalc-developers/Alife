using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Admin.Queries.GetAdminSelfDiagnostic;

public sealed class GetAdminSelfDiagnosticQueryHandler(IAlifeDbContext dbContext)
    : IRequestHandler<GetAdminSelfDiagnosticQuery, AppResult<AdminSelfDiagnosticDto>>
{
    public async Task<AppResult<AdminSelfDiagnosticDto>> Handle(
        GetAdminSelfDiagnosticQuery request,
        CancellationToken cancellationToken)
    {
        var member = await dbContext.Members
            .AsNoTracking()
            .Where(x => x.Id == request.CurrentMemberId)
            .Select(x => new
            {
                x.Id,
                x.DisplayName,
                x.IsRegistered,
                Roles = x.PlatformRoles
                    .Where(role => role.RevokedUtc == null)
                    .OrderByDescending(role => role.Role.Level)
                    .Select(role => new
                    {
                        role.Role.Code,
                        role.Role.Level
                    })
                    .ToList()
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (member is null)
        {
            return AppResult<AdminSelfDiagnosticDto>.NotFound("Current member was not found in the database.");
        }

        var highestRole = member.Roles.FirstOrDefault();
        var platformRoleLevel = highestRole?.Level ?? (int)PlatformRoleId.User;
        var platformRole = highestRole?.Code ?? "user";

        return AppResult<AdminSelfDiagnosticDto>.Success(new AdminSelfDiagnosticDto(
            member.Id,
            member.DisplayName,
            member.IsRegistered,
            false,
            platformRole,
            member.Roles.Select(role => role.Code).ToList(),
            platformRoleLevel,
            platformRoleLevel >= (int)PlatformRoleId.Admin));
    }
}
