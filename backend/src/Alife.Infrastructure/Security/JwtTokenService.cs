using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Alife.Application.Abstractions.Security;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace Alife.Infrastructure.Security;

public class JwtTokenService(IConfiguration configuration) : IJwtTokenService
{
	public (string Token, DateTime ExpiresUtc) CreateToken(Member member, bool isGuest)
	{
		var expiresUtc = DateTime.UtcNow.AddDays(isGuest ? 7 : 30);
		var claims = new List<Claim>
		{
			new(JwtRegisteredClaimNames.Sub, member.Id.ToString()),
			new(ClaimTypes.NameIdentifier, member.Id.ToString()),
			new("is_registered", member.IsRegistered ? "true" : "false"),
			new("is_admin", IsPlatformAdmin(member) ? "true" : "false"),
			new("platform_role", GetPlatformRoleCode(member))
		};

		return WriteToken(claims, expiresUtc);
	}

	public (string Token, DateTime ExpiresUtc) CreateGuestToken()
	{
		var expiresUtc = DateTime.UtcNow.AddDays(7);
		var claims = new List<Claim>
		{
			new("is_registered", "false"),
			new("is_admin", "false"),
			new("session_kind", "guest")
		};

		return WriteToken(claims, expiresUtc);
	}

	public (string Token, DateTime ExpiresUtc) CreateVerifiedLineToken(string lineUID, string? displayName, string? email)
	{
		var expiresUtc = DateTime.UtcNow.AddMinutes(30);
		var claims = new List<Claim>
		{
			new("is_registered", "false"),
			new("is_admin", "false"),
			new("verified_line_uid", lineUID),
			new("session_kind", "verified_line")
		};

		if (!string.IsNullOrWhiteSpace(displayName))
		{
			claims.Add(new Claim("line_display_name", displayName));
		}

		if (!string.IsNullOrWhiteSpace(email))
		{
			claims.Add(new Claim("line_email", email));
		}

		return WriteToken(claims, expiresUtc);
	}

	private (string Token, DateTime ExpiresUtc) WriteToken(IEnumerable<Claim> claims, DateTime expiresUtc)
	{
		var issuer = configuration["Jwt:Issuer"] ?? "alife-api";
		var audience = configuration["Jwt:Audience"] ?? "alife-web";
		var key = configuration["Jwt:Key"] ?? "replace-me-in-production-with-long-random-key";
		var keyId = configuration["Jwt:KeyId"] ?? "alife-local-hs256";

		var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key))
		{
			KeyId = keyId
		};

		var creds = new SigningCredentials(
			signingKey,
			SecurityAlgorithms.HmacSha256);

		var token = new JwtSecurityToken(issuer, audience, claims, expires: expiresUtc, signingCredentials: creds);
		return (new JwtSecurityTokenHandler().WriteToken(token), expiresUtc);
	}

	private static bool IsPlatformAdmin(Member member)
		=> member.PlatformRoles.Any(role =>
			   role.RevokedUtc is null &&
			   (role.RoleId == (int)PlatformRoleId.SuperAdmin ||
			    Alife.Application.Admin.AdminPermissionCatalog.ReadPermissions(
				    role.Role?.Code ?? string.Empty,
				    role.Role?.PermissionsJson)
				    .Contains(Alife.Application.Admin.AdminPermissionCatalog.AccessAdmin)));

	private static string GetPlatformRoleCode(Member member)
	{
		var role = member.PlatformRoles
			.Where(role => role.RevokedUtc is null)
			.OrderByDescending(role => role.Role?.Level ?? role.RoleId)
			.FirstOrDefault();

		return role?.Role?.Code ?? role?.RoleId switch
		{
			(int)PlatformRoleId.SuperAdmin => "superadmin",
			(int)PlatformRoleId.Admin => "admin",
			(int)PlatformRoleId.PageReviewer => "page_reviewer",
			_ => "user"
		};
	}
}
