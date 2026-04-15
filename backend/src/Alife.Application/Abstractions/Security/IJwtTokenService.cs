using Alife.Domain.Entities;

namespace Alife.Application.Abstractions.Security;

public interface IJwtTokenService
{
	(string Token, DateTime ExpiresUtc) CreateToken(Member member, bool isGuest);
	(string Token, DateTime ExpiresUtc) CreateGuestToken();
	(string Token, DateTime ExpiresUtc) CreateVerifiedPhoneToken(string phoneE164);
}