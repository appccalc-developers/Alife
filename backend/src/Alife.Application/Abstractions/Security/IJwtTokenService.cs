using Alife.Domain.Entities;

namespace Alife.Application.Abstractions.Security;

public interface IJwtTokenService
{
	(string Token, DateTime ExpiresUtc) CreateToken(Member member, bool isGuest);
}