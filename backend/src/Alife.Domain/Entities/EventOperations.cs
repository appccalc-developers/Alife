using Alife.Domain.Enums;

namespace Alife.Domain.Entities;

public sealed class EventTask
{
    public Guid Id { get; set; }
    public Guid EventId { get; set; }
    public Guid? WorkflowStepId { get; set; }
    public string TitleEn { get; set; } = string.Empty;
    public string TitleZh { get; set; } = string.Empty;
    public string DescriptionEn { get; set; } = string.Empty;
    public string DescriptionZh { get; set; } = string.Empty;
    public Guid? AssignedMemberId { get; set; }
    public EventTaskStatus Status { get; set; } = EventTaskStatus.Todo;
    public bool IsRequired { get; set; }
    public bool RequiresApproval { get; set; }
    public bool IsRestricted { get; set; }
    public DateTime? DueUtc { get; set; }
    public DateTime? CompletedUtc { get; set; }
    public Guid ConcurrencyToken { get; set; } = Guid.NewGuid();
    public DateTime CreatedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }

    public GroupEvent Event { get; set; } = null!;
    public EventWorkflowStep? WorkflowStep { get; set; }
    public Member? AssignedMember { get; set; }
    public ICollection<EventTaskDependency> Dependencies { get; set; } = [];
    public ICollection<EventTaskDependency> Dependants { get; set; } = [];
    public ICollection<EventTaskBlocker> Blockers { get; set; } = [];
}

public sealed class EventTaskDependency
{
    public Guid Id { get; set; }
    public Guid EventTaskId { get; set; }
    public Guid DependsOnEventTaskId { get; set; }
    public string DependencyType { get; set; } = "finishToStart";
    public DateTime CreatedUtc { get; set; }
    public EventTask EventTask { get; set; } = null!;
    public EventTask DependsOnEventTask { get; set; } = null!;
}

public sealed class EventTaskBlocker
{
    public Guid Id { get; set; }
    public Guid EventTaskId { get; set; }
    public string Reason { get; set; } = string.Empty;
    public Guid CreatedByMemberId { get; set; }
    public DateTime CreatedUtc { get; set; }
    public Guid? ResolvedByMemberId { get; set; }
    public string? Resolution { get; set; }
    public DateTime? ResolvedUtc { get; set; }
    public EventTask EventTask { get; set; } = null!;
    public Member CreatedByMember { get; set; } = null!;
    public Member? ResolvedByMember { get; set; }
}

public sealed class EventRosterAvailability
{
    public Guid Id { get; set; }
    public Guid ServiceSlotId { get; set; }
    public Guid MemberId { get; set; }
    public EventAvailabilityStatus Status { get; set; } = EventAvailabilityStatus.Unknown;
    public DateTime UpdatedUtc { get; set; }
    public EventServiceSlot ServiceSlot { get; set; } = null!;
    public Member Member { get; set; } = null!;
}

public sealed class EventRosterAssignment
{
    public Guid Id { get; set; }
    public Guid ServiceSlotId { get; set; }
    public Guid MemberId { get; set; }
    public Guid AssignedByMemberId { get; set; }
    public EventRosterAssignmentStatus Status { get; set; } = EventRosterAssignmentStatus.Invited;
    public Guid? ReplacesAssignmentId { get; set; }
    public DateTime? ConfirmedUtc { get; set; }
    public DateTime? DeclinedUtc { get; set; }
    public DateTime? EndedUtc { get; set; }
    public DateTime CreatedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }
    public EventServiceSlot ServiceSlot { get; set; } = null!;
    public Member Member { get; set; } = null!;
    public Member AssignedByMember { get; set; } = null!;
    public EventRosterAssignment? ReplacesAssignment { get; set; }
}
