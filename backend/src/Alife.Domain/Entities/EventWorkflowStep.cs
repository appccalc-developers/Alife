using Alife.Domain.Enums;

namespace Alife.Domain.Entities;

public class EventWorkflowStep
{
    public Guid Id { get; set; }
    public Guid WorkflowRunId { get; set; }
    public string StepKey { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public string NameEn { get; set; } = string.Empty;
    public string NameZh { get; set; } = string.Empty;
    public bool IsRequired { get; set; }
    public bool RequiresApproval { get; set; }
    public string? IntegrationKey { get; set; }
    public EventWorkflowStepStatus Status { get; set; } = EventWorkflowStepStatus.NotStarted;
    public Guid? AssignedMemberId { get; set; }
    public DateTime? DueUtc { get; set; }
    public Guid? CompletedByMemberId { get; set; }
    public DateTime? CompletedUtc { get; set; }
    public DateTime CreatedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }

    public EventWorkflowRun WorkflowRun { get; set; } = null!;
    public Member? AssignedMember { get; set; }
    public Member? CompletedByMember { get; set; }
    public ICollection<EventArtifact> Artifacts { get; set; } = [];
}
