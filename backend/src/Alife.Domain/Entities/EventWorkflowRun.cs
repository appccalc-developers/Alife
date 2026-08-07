using Alife.Domain.Enums;

namespace Alife.Domain.Entities;

public class EventWorkflowRun
{
    public Guid Id { get; set; }
    public Guid EventId { get; set; }
    public Guid TemplateId { get; set; }
    public int TemplateVersion { get; set; }
    public string TemplateSnapshotJson { get; set; } = "{}";
    public EventWorkflowRunStatus Status { get; set; } = EventWorkflowRunStatus.Active;
    public string? CurrentStepKey { get; set; }
    public DateTime StartedUtc { get; set; }
    public DateTime? CompletedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }

    public GroupEvent Event { get; set; } = null!;
    public EventWorkflowTemplate Template { get; set; } = null!;
    public ICollection<EventWorkflowStep> Steps { get; set; } = [];
}
