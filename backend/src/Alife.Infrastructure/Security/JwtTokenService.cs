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
		var issuer = configuration["Jwt:Issuer"] ?? "alife-api";
		var audience = configuration["Jwt:Audience"] ?? "alife-web";
		var key = configuration["Jwt:Key"] ?? "replace-me-in-production-with-long-random-key";

		var expiresUtc = DateTime.UtcNow.AddDays(isGuest ? 7 : 30);
		var claims = new List<Claim>
		{
			new(JwtRegisteredClaimNames.Sub, member.Id.ToString()),
			new(ClaimTypes.NameIdentifier, member.Id.ToString()),
			new("is_registered", member.IsRegistered ? "true" : "false"),
			new("is_admin", member.IsAdmin ? "true" : "false")
		};

		var creds = new SigningCredentials(
			new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),
			SecurityAlgorithms.HmacSha256);

		var token = new JwtSecurityToken(issuer, audience, claims, expires: expiresUtc, signingCredentials: creds);
		return (new JwtSecurityTokenHandler().WriteToken(token), expiresUtc);
	}
}