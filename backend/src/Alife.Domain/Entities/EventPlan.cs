using Alife.Domain.Enums;

namespace Alife.Domain.Entities;

public class EventPlan
{
    public Guid Id { get; set; }
    public Guid EventId { get; set; }
    public int CurrentRevision { get; set; }
    public EventPlanStatus Status { get; set; }
    public DateTime CreatedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }
    public GroupEvent Event { get; set; } = null!;
    public ICollection<EventPlanRevision> Revisions { get; set; } = [];
    public ICollection<EventOccurrence> Occurrences { get; set; } = [];
    public ICollection<EventModuleInstance> Modules { get; set; } = [];
    public ICollection<EventReadinessGate> ReadinessGates { get; set; } = [];
    public ICollection<EventDecisionRecord> Decisions { get; set; } = [];
}
