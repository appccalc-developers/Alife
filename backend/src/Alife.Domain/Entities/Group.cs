using Alife.Domain.Enums;

namespace Alife.Domain.Entities;

public class Group
{
	public Guid Id { get; set; }
	public string NameJson { get; set; } = "{}";
	public string? DescriptionJson { get; set; }
	public Guid? ParentGroupId { get; set; }
	public AccessType AccessType { get; set; }
	public bool IsChurch { get; set; }
	public bool IsClosed { get; set; }
	public DateTime CreatedUtc { get; set; }
	public DateTime UpdatedUtc { get; set; }

	public Group? ParentGroup { get; set; }
	public ICollection<Group> Subgroups { get; set; } = [];
	public ICollection<GroupMembership> Memberships { get; set; } = [];
	public ICollection<ContactProfile> ContactProfiles { get; set; } = [];
	public ICollection<Venue> Venues { get; set; } = [];
	public ICollection<EventSeries> EventSeries { get; set; } = [];
	public ICollection<GroupRosterCapability> RosterCapabilities { get; set; } = [];
}
