namespace Alife.Application.Members.Dtos;

public sealed record MemberRegistrationResultDto(string Token, DateTime ExpiresUtc);
