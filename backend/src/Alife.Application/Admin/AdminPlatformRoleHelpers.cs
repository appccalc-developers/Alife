using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Interfaces;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Alife.Application.Admin;

internal static class AdminPlatformRoleHelpers
{
    public const string PageReviewerRoleCode = "page_reviewer";

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
        => await dbContext.MemberPlatformRoles
            .AsNoTracking()
            .AnyAsync(
                x => x.MemberId == memberId &&
                     x.RevokedUtc == null &&
                     (x.RoleId == (int)PlatformRoleId.PageReviewer ||
                      x.RoleId == (int)PlatformRoleId.Admin ||
                      x.RoleId == (int)PlatformRoleId.SuperAdmin),
                cancellationToken);

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
        var rows = await QueryAdminMembers(dbContext)
            .Where(x => x.Id == memberId)
            .ToListAsync(cancellationToken);

        return rows.FirstOrDefault();
    }

    public static IQueryable<AdminMemberDto> QueryAdminMembers(IAlifeDbContext dbContext)
        => ProjectAdminMembers(dbContext.Members.AsNoTracking());

    public static IQueryable<AdminMemberDto> ProjectAdminMembers(IQueryable<Member> members)
        => members.Select(member => new AdminMemberDto(
                member.Id,
                member.DisplayName,
                member.Email,
                member.PhoneE164,
                member.IsRegistered,
                false,
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
                member.Memberships.Count(m => m.Status == MembershipStatus.Requested)));

    public static IReadOnlyDictionary<string, string> ReadTextMap(string json)
        => string.IsNullOrWhiteSpace(json)
            ? new Dictionary<string, string>()
            : JsonSerializer.Deserialize<Dictionary<string, string>>(json) ?? new Dictionary<string, string>();

    public static string NormalizeRoleCode(string roleCode)
        => roleCode.Trim().ToLowerInvariant() switch
        {
            "superadmin" or "super_admin" or "super-admin" => "superadmin",
            "admin" => "admin",
            "page_reviewer" or "page-reviewer" or "pagereviewer" or "publisher" or "publish_reviewer" or "publish-reviewer" => PageReviewerRoleCode,
            "user" or "member" => "user",
            _ => string.Empty
        };

    public static string RoleChangedMetadata(string roleCode)
        => JsonSerializer.Serialize(new { role = roleCode });
}
