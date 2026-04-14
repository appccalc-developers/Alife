using Alife.Domain.Enums;

namespace Alife.Domain.Entities;

public class GroupMembership
{
	public Guid Id { get; set; }
	public Guid GroupId { get; set; }
	public Guid MemberId { get; set; }
	public MembershipStatus Status { get; set; }
	public MembershipRole Role { get; set; }
	public DateTime CreatedUtc { get; set; }
	public DateTime UpdatedUtc { get; set; }

	public Group Group { get; set; } = null!;
	public Member Member { get; set; } = null!;
}