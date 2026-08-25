using Alife.Domain.Enums;

namespace Alife.Domain.Entities;

public class EventReadinessGate
{
    public Guid Id { get; set; }
    public Guid EventPlanId { get; set; }
    public Guid? ModuleInstanceId { get; set; }
    public string GateKey { get; set; } = string.Empty;
    public string NameEn { get; set; } = string.Empty;
    public string NameZh { get; set; } = string.Empty;
    public bool IsRequired { get; set; }
    public EventReadinessStatus Status { get; set; }
    public string ExplanationJson { get; set; } = "{}";
    public DateTime UpdatedUtc { get; set; }
    public EventPlan EventPlan { get; set; } = null!;
    public EventModuleInstance? ModuleInstance { get; set; }
}
