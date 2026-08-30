using System.IdentityModel.Tokens.Jwt;
using Alife.Domain.Entities;
using Alife.Infrastructure.Security;
using Microsoft.Extensions.Configuration;

namespace Alife.Tests.Unit;

public class JwtTokenServiceTests
{
	private static JwtTokenService CreateService()
	{
		var configuration = new ConfigurationBuilder()
			.AddInMemoryCollection(new Dictionary<string, string?>
			{
				["Jwt:Issuer"] = "alife-tests",
				["Jwt:Audience"] = "alife-web",
				["Jwt:Key"] = "this-is-a-long-test-key-for-auth-claims",
				["Jwt:KeyId"] = "test-key"
			})
			.Build();

		return new JwtTokenService(configuration);
	}

	[Fact]
	public void CreateToken_DoesNotIncludeLanguageClaim()
	{
		var service = CreateService();
		var member = new Member
		{
			Id = Guid.NewGuid(),
			IsRegistered = true
		};

		var (token, _) = service.CreateToken(member, isGuest: false);
		var jwt = new JwtSecurityTokenHandler().ReadJwtToken(token);

		Assert.DoesNotContain(jwt.Claims, claim => claim.Type == "language");
	}

	[Fact]
	public void CreateGuestToken_DoesNotIncludeLanguageClaim()
	{
		var service = CreateService();
		var (token, _) = service.CreateGuestToken();
		var jwt = new JwtSecurityTokenHandler().ReadJwtToken(token);

		Assert.DoesNotContain(jwt.Claims, claim => claim.Type == "language");
	}

	[Fact]
	public void CreateToken_IncludesStableAuthenticationAndSessionClaims()
	{
		var service = CreateService();
		var member = new Member
		{
			Id = Guid.NewGuid(),
			IsRegistered = true
		};

		var (token, _) = service.CreateToken(member, "passkey", "public_device", TimeSpan.FromHours(2));
		var jwt = new JwtSecurityTokenHandler().ReadJwtToken(token);

		Assert.Contains(jwt.Claims, claim => claim.Type == "amr" && claim.Value == "passkey");
		Assert.Contains(jwt.Claims, claim => claim.Type == "session_kind" && claim.Value == "public_device");
		Assert.Contains(jwt.Claims, claim => claim.Type == "auth_time" && long.TryParse(claim.Value, out _));
	}
}
