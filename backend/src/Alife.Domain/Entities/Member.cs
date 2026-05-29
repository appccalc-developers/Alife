using Alife.Domain.Constants;

namespace Alife.Domain.Entities;

public class Member
{
	public Guid Id { get; set; }
	public string? DisplayName { get; set; }
	public string? Sex { get; set; }
	public int? Age { get; set; }
	public string? Email { get; set; }
	public string? PhoneE164 { get; set; }
	public string? LineUID { get; set; }
	public string Language { get; set; } = MemberLanguage.Zh;
	public DateTime? PhoneVerifiedUtc { get; set; }
	public bool IsRegistered { get; set; }
	public bool IsAdmin { get; set; }
	public DateTime CreatedUtc { get; set; }
	public DateTime UpdatedUtc { get; set; }

	public ICollection<GroupMembership> Memberships { get; set; } = [];
}
