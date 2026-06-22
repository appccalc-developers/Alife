namespace Alife.Domain.Entities;

public class AuditLog
{
	public Guid Id { get; set; }
	public Guid? ActorMemberId { get; set; }
	public string Action { get; set; } = string.Empty;
	public string EntityType { get; set; } = string.Empty;
	public Guid? EntityId { get; set; }
	public Guid? GroupId { get; set; }
	public Guid? EventId { get; set; }
	public Guid? TargetMemberId { get; set; }
	public string? BeforeJson { get; set; }
	public string? AfterJson { get; set; }
	public string? MetadataJson { get; set; }
	public string? IpAddress { get; set; }
	public string? UserAgent { get; set; }
	public DateTime OccurredUtc { get; set; }

	public Member? ActorMember { get; set; }
	public Member? TargetMember { get; set; }
	public Group? Group { get; set; }
	public GroupEvent? Event { get; set; }
}
