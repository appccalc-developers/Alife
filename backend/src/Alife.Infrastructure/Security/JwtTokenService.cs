using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Alife.Application.Abstractions.Security;
using Alife.Domain.Entities;
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
			new("is_admin", member.IsAdmin ? "true" : "false")
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

	public (string Token, DateTime ExpiresUtc) CreateVerifiedPhoneToken(string phoneE164)
	{
		var expiresUtc = DateTime.UtcNow.AddMinutes(30);
		var claims = new List<Claim>
		{
			new("is_registered", "false"),
			new("is_admin", "false"),
			new("verified_phone", phoneE164),
			new("session_kind", "verified_phone")
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
}