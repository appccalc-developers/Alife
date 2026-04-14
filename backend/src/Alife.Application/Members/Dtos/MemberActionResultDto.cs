namespace Alife.Application.Members.Dtos;

public sealed record MemberActionResultDto(
	bool Ok,
	string? PhoneE164 = null,
	string? DisplayName = null,
	string? Sex = null,
	int? Age = null,
	string? Email = null,
	bool IsRegistered = false);
