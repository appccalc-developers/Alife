using Alife.Application.Admin;
using Alife.Application.Common;
using Alife.Application.Members.Dtos;
using Alife.Application.Members.Services;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Alife.Infrastructure.ReadServices;

public sealed class MemberReadService(AlifeDbContext dbContext) : IMemberReadService
{
    public async Task<CurrentMemberDto?> GetCurrentMemberAsync(Guid memberId, CancellationToken cancellationToken)
    {
        var member = await dbContext.Members
            .AsNoTracking()
            .Where(x => x.Id == memberId)
            .Select(x => new
            {
                x.Id,
                x.DisplayName,
                x.Sex,
                x.Age,
                x.Email,
                x.PhoneE164,
                x.IsRegistered,
                HasPasskey = x.PasskeyCredentials.Any(credential => credential.RevokedUtc == null),
                PlatformRoles = x.PlatformRoles
                    .Where(role => role.RevokedUtc == null)
                    .Select(role => new
                    {
                        role.Role.Code,
                        role.Role.Level,
                        role.Role.PermissionsJson
                    })
                    .ToList(),
                Memberships = x.Memberships
                    .Select(m => new
                    {
                        m.GroupId,
                        m.Status,
                        m.Role,
                        GroupNameJson = m.Group.NameJson,
                        m.Group.ParentGroupId,
                        m.Group.IsChurch
                    })
                    .ToList()
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (member is null)
        {
            return null;
        }

        var permissions = member.PlatformRoles.Any(role => role.Code == "superadmin")
            ? AdminPermissionCatalog.GetDefaultPermissions("superadmin")
            : member.PlatformRoles
                .SelectMany(role => AdminPermissionCatalog.ReadPermissions(role.Code, role.PermissionsJson))
                .Distinct(StringComparer.Ordinal)
                .OrderBy(code => code, StringComparer.Ordinal)
                .ToArray();

        return new CurrentMemberDto(
                member.Id,
                member.DisplayName,
                member.Sex,
                member.Age,
                member.Email,
                member.PhoneE164,
                !member.IsRegistered,
                member.IsRegistered,
                member.PlatformRoles.Any(role =>
                    role.Code == "superadmin" ||
                    AdminPermissionCatalog.ReadPermissions(role.Code, role.PermissionsJson)
                        .Contains(AdminPermissionCatalog.AccessAdmin)),
                member.PlatformRoles.OrderByDescending(role => role.Level).FirstOrDefault()?.Code ?? "user",
                permissions,
                member.Memberships
                    .Select(m => new MemberMembershipDto(
                        m.GroupId,
                        EnumName.CamelCase(m.Status),
                        EnumName.CamelCase(m.Role),
                        ReadTextMap(m.GroupNameJson),
                        m.ParentGroupId))
                    .ToList(),
                NeedsPasskey: member.IsRegistered && !member.HasPasskey);
    }

    private static IReadOnlyDictionary<string, string> ReadTextMap(string? value)
        => string.IsNullOrWhiteSpace(value)
            ? new Dictionary<string, string>()
            : JsonSerializer.Deserialize<Dictionary<string, string>>(value) ?? new Dictionary<string, string>();
}
