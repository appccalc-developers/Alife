using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Interfaces;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Alife.Application.Admin;

internal static class AdminPlatformRoleHelpers
{
    public const string PageReviewerRoleCode = "page_reviewer";
    public const string VisitorContactReceiverRoleCode = "visitor_contact_receiver";

    public static async Task<int> GetPlatformRoleLevelAsync(
        IAlifeDbContext dbContext,
        Guid memberId,
        CancellationToken cancellationToken)
    {
        var level = await dbContext.MemberPlatformRoles
            .AsNoTracking()
            .Where(x => x.MemberId == memberId && x.RevokedUtc == null)
            .OrderByDescending(x => x.Role.Level)
            .Select(x => (int?)x.Role.Level)
            .FirstOrDefaultAsync(cancellationToken);

        if (level is not null)
        {
            return level.Value;
        }

        return 0;
    }

    public static async Task<bool> IsPlatformAdminAsync(
        IAlifeDbContext dbContext,
        Guid memberId,
        CancellationToken cancellationToken)
        => await GetPlatformRoleLevelAsync(dbContext, memberId, cancellationToken) >= (int)PlatformRoleId.Admin;

    public static async Task<bool> CanReviewPagesAsync(
        IAlifeDbContext dbContext,
        Guid memberId,
        CancellationToken cancellationToken)
    {
        var roles = await dbContext.MemberPlatformRoles
            .AsNoTracking()
            .Where(x => x.MemberId == memberId && x.RevokedUtc == null)
            .Select(x => new
            {
                x.RoleId,
                x.Role.Code,
                x.Role.PermissionsJson
            })
            .ToListAsync(cancellationToken);

        return roles.Any(role =>
            role.RoleId == (int)PlatformRoleId.PageReviewer ||
            role.RoleId == (int)PlatformRoleId.SuperAdmin ||
            AdminPermissionCatalog.ReadPermissions(role.Code, role.PermissionsJson)
                .Contains(AdminPermissionCatalog.ReviewPages));
    }

    public static async Task<bool> IsSuperAdminAsync(
        IAlifeDbContext dbContext,
        Guid memberId,
        CancellationToken cancellationToken)
        => await GetPlatformRoleLevelAsync(dbContext, memberId, cancellationToken) >= (int)PlatformRoleId.SuperAdmin;

    public static async Task<AdminMemberDto?> GetAdminMemberDtoAsync(
        IAlifeDbContext dbContext,
        Guid memberId,
        CancellationToken cancellationToken)
    {
        var rows = await ProjectAdminMembers(dbContext.Members.AsNoTracking().Where(x => x.Id == memberId))
            .ToListAsync(cancellationToken);

        return rows.FirstOrDefault();
    }

    public static IQueryable<AdminMemberDto> QueryAdminMembers(IAlifeDbContext dbContext)
        => ProjectAdminMembers(dbContext.Members.AsNoTracking());

    public static IQueryable<AdminMemberDto> ProjectAdminMembers(IQueryable<Member> members)
        => members.Select(member => new AdminMemberDto(
                member.Id,
                member.DisplayName,
                member.Salutation,
                member.Sex,
                member.Email,
                member.PhoneE164,
                member.IsRegistered,
                !member.PasskeyCredentials.Any(credential => credential.RevokedUtc == null),
                false,
                member.CreatedUtc,
                member.UpdatedUtc,
                member.PlatformRoles
                    .Where(role => role.RevokedUtc == null)
                    .OrderByDescending(role => role.Role.Level)
                    .Select(role => role.Role.Code)
                    .FirstOrDefault() ?? "user",
                member.PlatformRoles
                    .Where(role => role.RevokedUtc == null)
                    .OrderByDescending(role => role.Role.Level)
                    .Select(role => role.Role.Code)
                    .ToList(),
                member.Memberships.Count(m => m.Status == MembershipStatus.Approved),
                member.Memberships.Count(m => m.Status == MembershipStatus.Requested),
                member.Memberships
                    .Where(membership => membership.Group.IsChurch)
                    .OrderByDescending(membership => membership.UpdatedUtc)
                    .Select(membership => (MembershipStatus?)membership.Status)
                    .FirstOrDefault(),
                member.Memberships
                    .Where(membership => membership.Group.IsChurch)
                    .OrderByDescending(membership => membership.UpdatedUtc)
                    .Select(membership => (MembershipRole?)membership.Role)
                    .FirstOrDefault(),
                member.Memberships.Any(membership =>
                    !membership.Group.IsChurch &&
                    membership.Status == MembershipStatus.Approved &&
                    membership.Role == MembershipRole.Leader),
                member.Memberships
                    .Where(membership => !membership.Group.IsChurch && membership.Status == MembershipStatus.Approved)
                    .OrderBy(membership => membership.Group.NameJson)
                    .Select(membership => new AdminMemberGroupDto(
                        membership.GroupId,
                        membership.Group.NameJson,
                        membership.Status,
                        membership.Role))
                    .ToList()));

    public static async Task<bool> HasPermissionAsync(
        IAlifeDbContext dbContext,
        Guid memberId,
        string permissionCode,
        CancellationToken cancellationToken)
    {
        var roles = await dbContext.MemberPlatformRoles
            .AsNoTracking()
            .Where(x => x.MemberId == memberId && x.RevokedUtc == null)
            .OrderByDescending(x => x.Role.Level)
            .Select(x => new
            {
                x.Role.Code,
                x.Role.PermissionsJson
            })
            .ToListAsync(cancellationToken);

        if (roles.Any(x => x.Code == "superadmin"))
        {
            return true;
        }

        return roles.Any(role =>
            AdminPermissionCatalog.ReadPermissions(role.Code, role.PermissionsJson).Contains(permissionCode));
    }

    public static async Task<IReadOnlyList<string>> GetMemberPermissionsAsync(
        IAlifeDbContext dbContext,
        Guid memberId,
        CancellationToken cancellationToken)
    {
        var roles = await dbContext.MemberPlatformRoles
            .AsNoTracking()
            .Where(x => x.MemberId == memberId && x.RevokedUtc == null)
            .OrderByDescending(x => x.Role.Level)
            .Select(x => new
            {
                x.Role.Code,
                x.Role.PermissionsJson
            })
            .ToListAsync(cancellationToken);

        if (roles.Any(x => x.Code == "superadmin"))
        {
            return AdminPermissionCatalog.GetDefaultPermissions("superadmin");
        }

        return roles
            .SelectMany(role => AdminPermissionCatalog.ReadPermissions(role.Code, role.PermissionsJson))
            .Distinct(StringComparer.Ordinal)
            .OrderBy(x => x, StringComparer.Ordinal)
            .ToArray();
    }

    public static IReadOnlyDictionary<string, string> ReadTextMap(string json)
        => string.IsNullOrWhiteSpace(json)
            ? new Dictionary<string, string>()
            : JsonSerializer.Deserialize<Dictionary<string, string>>(json) ?? new Dictionary<string, string>();

    public static string NormalizeRoleCode(string roleCode)
    {
        var normalized = roleCode.Trim().ToLowerInvariant() switch
        {
            "superadmin" or "super_admin" or "super-admin" => "superadmin",
            "admin" => "admin",
            "page_reviewer" or "page-reviewer" or "pagereviewer" or "publisher" or "publish_reviewer" or "publish-reviewer" => PageReviewerRoleCode,
            "visitor_contact_receiver" or "visitor-contact-receiver" or "visitorreceiver" or "visitor_contact" or "visitor-contact" => VisitorContactReceiverRoleCode,
            "user" or "member" => "user",
            _ => roleCode.Trim().ToLowerInvariant()
        };

        return Regex.IsMatch(normalized, "^[a-z][a-z0-9._-]{1,49}$") ? normalized : string.Empty;
    }

    public static bool IsSystemRole(string roleCode)
        => roleCode is "user" or PageReviewerRoleCode or VisitorContactReceiverRoleCode or "admin" or "superadmin";

    public static IReadOnlyDictionary<string, string> TextMap(string en, string zh)
        => new Dictionary<string, string>
        {
            ["en"] = en,
            ["zh"] = zh
        };

    public static string WriteTextMap(string en, string zh)
        => JsonSerializer.Serialize(TextMap(en, zh));

    public static string RoleChangedMetadata(string roleCode)
        => JsonSerializer.Serialize(new { role = roleCode });
}
