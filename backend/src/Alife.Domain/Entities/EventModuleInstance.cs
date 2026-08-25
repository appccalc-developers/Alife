using Alife.Domain.Enums;

namespace Alife.Domain.Entities;

public class EventModuleInstance
{
    public Guid Id { get; set; }
    public Guid EventPlanId { get; set; }
    public string ModuleKey { get; set; } = string.Empty;
    public int ModuleVersion { get; set; }
    public bool IsRequired { get; set; }
    public EventModuleStatus Status { get; set; }
    public string ConfigurationJson { get; set; } = "{}";
    public Guid AddedByMemberId { get; set; }
    public DateTime CreatedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }
    public EventPlan EventPlan { get; set; } = null!;
    public Member AddedByMember { get; set; } = null!;
}
