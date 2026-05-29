using System.IdentityModel.Tokens.Jwt;
using Alife.Domain.Constants;
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
				["Jwt:Key"] = "this-is-a-long-test-key-for-language-claims",
				["Jwt:KeyId"] = "test-key"
			})
			.Build();

		return new JwtTokenService(configuration);
	}

	[Fact]
	public void CreateToken_IncludesMemberLanguageClaim()
	{
		var service = CreateService();
		var member = new Member
		{
			Id = Guid.NewGuid(),
			IsRegistered = true,
			Language = MemberLanguage.En
		};

		var (token, _) = service.CreateToken(member, isGuest: false);
		var jwt = new JwtSecurityTokenHandler().ReadJwtToken(token);

		Assert.Equal(MemberLanguage.En, jwt.Claims.First(claim => claim.Type == "language").Value);
	}

	[Fact]
	public void CreateGuestToken_UsesZhLanguageClaimByDefault()
	{
		var service = CreateService();
		var (token, _) = service.CreateGuestToken();
		var jwt = new JwtSecurityTokenHandler().ReadJwtToken(token);

		Assert.Equal(MemberLanguage.Zh, jwt.Claims.First(claim => claim.Type == "language").Value);
	}
}