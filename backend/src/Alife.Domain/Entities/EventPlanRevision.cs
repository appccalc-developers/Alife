namespace Alife.Domain.Entities;

public class EventPlanRevision
{
    public Guid Id { get; set; }
    public Guid EventPlanId { get; set; }
    public int Revision { get; set; }
    public int SchemaVersion { get; set; }
    public string FactsJson { get; set; } = "{}";
    public string CompositionJson { get; set; } = "{}";
    public string ChangeReason { get; set; } = string.Empty;
    public Guid CreatedByMemberId { get; set; }
    public DateTime CreatedUtc { get; set; }
    public EventPlan EventPlan { get; set; } = null!;
    public Member CreatedByMember { get; set; } = null!;
}
