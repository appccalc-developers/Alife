namespace Alife.Domain.Enums;

public enum EventWorkflowStepStatus
{
    NotStarted = 1,
    InProgress = 2,
    AwaitingApproval = 3,
    NeedsChanges = 4,
    Completed = 5,
    Skipped = 6
}
