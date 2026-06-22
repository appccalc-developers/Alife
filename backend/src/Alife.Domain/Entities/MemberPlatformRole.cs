namespace Alife.Domain.Entities;

public class MemberPlatformRole
{
	public Guid Id { get; set; }
	public Guid MemberId { get; set; }
	public int RoleId { get; set; }
	public Guid? AssignedByMemberId { get; set; }
	public DateTime AssignedUtc { get; set; }
	public DateTime? RevokedUtc { get; set; }

	public Member Member { get; set; } = null!;
	public PlatformRole Role { get; set; } = null!;
	public Member? AssignedByMember { get; set; }
}
