using Alife.Domain.Enums;

namespace Alife.Domain.Entities;

public class EventRamAssessment
{
    public Guid EventId { get; set; }
    public string RamDataJson { get; set; } = "{}";
    public EventRamStatus Status { get; set; } = EventRamStatus.Draft;
    public Guid? SubmittedByMemberId { get; set; }
    public DateTime? SubmittedUtc { get; set; }
    public Guid? ApprovedByMemberId { get; set; }
    public DateTime? ApprovedUtc { get; set; }
    public DateTime CreatedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }

    public GroupEvent Event { get; set; } = null!;
    public Member? SubmittedByMember { get; set; }
    public Member? ApprovedByMember { get; set; }
}
