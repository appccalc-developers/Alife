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
	public DateTime? PhoneVerifiedUtc { get; set; }
	public bool IsRegistered { get; set; }
	public DateTime CreatedUtc { get; set; }
	public DateTime UpdatedUtc { get; set; }

	public ICollection<GroupMembership> Memberships { get; set; } = [];
	public ICollection<MemberPlatformRole> PlatformRoles { get; set; } = [];
	public ICollection<MemberPlatformRole> AssignedPlatformRoles { get; set; } = [];
	public ICollection<ForumPost> ForumPosts { get; set; } = [];
	public ICollection<ForumComment> ForumComments { get; set; } = [];
	public BibleReadingProgress? BibleReadingProgress { get; set; }
	public ICollection<ContactProfile> ContactProfiles { get; set; } = [];
}
