using Alife.Domain.Enums;

namespace Alife.Domain.Entities;

public class EventDecisionRecord
{
    public Guid Id { get; set; }
    public Guid EventPlanId { get; set; }
    public Guid? ModuleInstanceId { get; set; }
    public string DecisionKey { get; set; } = string.Empty;
    public EventDecisionStatus Status { get; set; }
    public Guid RequestedByMemberId { get; set; }
    public Guid? DecidedByMemberId { get; set; }
    public string RequestJson { get; set; } = "{}";
    public string DecisionNotes { get; set; } = string.Empty;
    public DateTime RequestedUtc { get; set; }
    public DateTime? DecidedUtc { get; set; }
    public EventPlan EventPlan { get; set; } = null!;
    public EventModuleInstance? ModuleInstance { get; set; }
    public Member RequestedByMember { get; set; } = null!;
    public Member? DecidedByMember { get; set; }
}
