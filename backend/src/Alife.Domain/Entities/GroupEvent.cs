namespace Alife.Domain.Entities;

public class GroupEvent
{
	public Guid Id { get; set; }
	public Guid GroupId { get; set; }
	public Guid CreatedByMemberId { get; set; }

	public string TitleEn { get; set; } = string.Empty;
	public string TitleZh { get; set; } = string.Empty;

	public DateTime StartDate { get; set; }
	public DateTime EndDate { get; set; }

	/// <summary>Full serialised <c>EventDto</c> JSON for rich event data.</summary>
	public string EventDataJson { get; set; } = "{}";

	public DateTime CreatedUtc { get; set; }
	public DateTime UpdatedUtc { get; set; }
	public bool IsDeleted { get; set; }

	public Group Group { get; set; } = null!;
	public Member CreatedByMember { get; set; } = null!;
	public ICollection<EventContactProfile> ContactProfiles { get; set; } = [];
	public EventRamAssessment? RamAssessment { get; set; }
}
