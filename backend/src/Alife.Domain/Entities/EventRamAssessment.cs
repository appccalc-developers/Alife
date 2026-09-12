using Alife.Domain.Enums;

namespace Alife.Domain.Entities;

public class EventRamAssessment
{
    public int SchemaVersion { get; set; } = 1;
    public Guid ConcurrencyToken { get; set; } = Guid.NewGuid();
    public Guid? PolicyVersionId { get; set; }
    public Guid? CurrentRevisionId { get; set; }
    public Guid? AuthorMemberId { get; set; }
    public string Validity { get; set; } = "Legacy";
    public string ResidualLevel { get; set; } = "Incomplete";
    public bool ReviewRequested { get; set; }
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
