using Alife.Domain.Enums;

namespace Alife.Application.Events.Dtos;

public sealed record EventPlanOccurrenceDto(Guid Id, string Key, WorkflowTextDto Name, DateTime StartUtc, DateTime EndUtc, string TimeZoneId, int SortOrder);
public sealed record EventPlanModuleDto(Guid Id, string Key, int Version, bool IsRequired, EventModuleStatus Status);
public sealed record EventPlanRegistrationSummaryDto(
    int MaxCapacity,
    string CapacityUnit,
    int EnrollmentCount,
    int ReservedUnits,
    int RemainingUnits,
    DateTime? RegistrationDeadlineUtc,
    string State);
public sealed record EventReadinessGateDto(Guid Id, Guid? ModuleInstanceId, string Key, WorkflowTextDto Name, bool IsRequired, EventReadinessStatus Status, string ExplanationJson);
public sealed record EventPlanDecisionDto(
    Guid Id,
    Guid? ModuleInstanceId,
    string Key,
    EventDecisionStatus Status,
    Guid RequestedByMemberId,
    string? RequestedByDisplayName,
    Guid? DecidedByMemberId,
    string? DecidedByDisplayName,
    string DecisionNotes,
    DateTime RequestedUtc,
    DateTime? DecidedUtc);
public sealed record EventPlanApprovalItemDto(
    string Key,
    Guid? ReferenceId,
    Guid? ModuleInstanceId,
    WorkflowTextDto Subject,
    string Status,
    Guid? RequestedByMemberId,
    string? RequestedByDisplayName,
    Guid? DecidedByMemberId,
    string? DecidedByDisplayName,
    string DecisionNotes,
    DateTime? RequestedUtc,
    DateTime? DecidedUtc);
public sealed record EventPlanMilestoneCheckDto(
    string Key,
    WorkflowTextDto Name,
    string Status,
    string? ModuleKey);
public sealed record EventPlanMilestoneDto(
    string Key,
    WorkflowTextDto Name,
    string Status,
    IReadOnlyList<EventPlanMilestoneCheckDto> Checks);
public sealed record EventPlanPreparationTaskItemDto(
    Guid Id,
    string ModuleKey,
    WorkflowTextDto Title,
    Guid? AssignedMemberId,
    string? AssignedDisplayName,
    DateTime? DueUtc,
    EventPreparationTaskStatus Status,
    bool IsBlocked);
public sealed record EventPlanPreparationTaskSummaryDto(
    int RequiredCount,
    int CompletedCount,
    int UnassignedCount,
    int MissingDueDateCount,
    int DueAfterEventCount,
    int OverdueCount,
    int BlockedCount,
    IReadOnlyList<EventPlanPreparationTaskItemDto> NextTasks);
public sealed record EventPlanDto(
    Guid Id,
    Guid EventId,
    int CurrentRevision,
    EventPlanStatus Status,
    bool IsLegacyProjection,
    DateTime UpdatedUtc,
    DateTime EventStartUtc,
    DateTime EventEndUtc,
    IReadOnlyList<EventPlanOccurrenceDto> Occurrences,
    IReadOnlyList<EventPlanModuleDto> Modules,
    IReadOnlyList<EventReadinessGateDto> ReadinessGates,
    IReadOnlyList<EventPlanDecisionDto> Decisions,
    IReadOnlyList<EventPlanApprovalItemDto> Approvals,
    IReadOnlyList<EventPlanMilestoneDto> Milestones,
    EventPlanPreparationTaskSummaryDto? PreparationTasks,
    EventPlanRegistrationSummaryDto? Registration);
