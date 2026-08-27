using Alife.Domain.Enums;

namespace Alife.Application.Events.Dtos;

public sealed record EventTeamMemberDto(Guid Id, Guid EventId, Guid MemberId, string DisplayName,
    EventTeamMemberStatus Status, DateTime? JoinedUtc, DateTime? DeclinedUtc, DateTime? EndedUtc);
public sealed record InviteEventTeamMemberRequest(Guid MemberId);

public sealed record EventTaskDependencyDto(Guid Id, Guid DependsOnEventTaskId, string DependencyType);
public sealed record EventTaskBlockerDto(Guid Id, string Reason, Guid CreatedByMemberId, DateTime CreatedUtc,
    Guid? ResolvedByMemberId, string? Resolution, DateTime? ResolvedUtc);
public sealed record EventTaskDto(Guid Id, Guid EventId, Guid? WorkflowStepId, LocalizedTextDto Title,
    LocalizedTextDto Description, Guid? AssignedMemberId, EventTaskStatus Status, bool IsRequired,
    bool RequiresApproval, bool IsRestricted, DateTime? DueUtc, DateTime? CompletedUtc, string ETag,
    IReadOnlyList<EventTaskDependencyDto> Dependencies, IReadOnlyList<EventTaskBlockerDto> Blockers);
public sealed record CreateEventTaskRequest(LocalizedTextDto Title, LocalizedTextDto? Description,
    Guid? AssignedMemberId, DateTime? DueUtc, bool IsRequired = false, bool RequiresApproval = false,
    bool IsRestricted = false, Guid? WorkflowStepId = null);
public sealed record UpdateEventTaskRequest(LocalizedTextDto Title, LocalizedTextDto? Description,
    Guid? AssignedMemberId, DateTime? DueUtc, EventTaskStatus Status, bool IsRequired,
    bool RequiresApproval, bool IsRestricted);
public sealed record AddEventTaskDependencyRequest(Guid DependsOnEventTaskId, string DependencyType = "finishToStart");
public sealed record AddEventTaskBlockerRequest(string Reason);
public sealed record ResolveEventTaskBlockerRequest(string Resolution);
public sealed record EventTeamWorkspaceDto(IReadOnlyList<EventTeamMemberDto> Members,
    IReadOnlyList<EventRoleAssignmentDto> Roles, IReadOnlyList<EventTaskDto> Tasks,
    IReadOnlyList<RoleRequirementDto> RoleRequirements, IReadOnlyList<LocalizedTextDto> ReadinessBlockers, bool CanManage);

public sealed record EventSessionDto(Guid Id, Guid OccurrenceId, LocalizedTextDto Title, DateTime StartUtc,
    DateTime EndUtc, string PlaceJson, Guid? LeadMemberId, EventSessionStatus Status,
    IReadOnlyList<EventProgramItemDto> Items);
public sealed record EventProgramItemDto(Guid Id, Guid SessionId, LocalizedTextDto Title,
    LocalizedTextDto Description, int SortOrder, int StartOffsetMinutes, int DurationMinutes, Guid? OwnerMemberId);
public sealed record EventProgrammeDto(Guid EventId, Guid OccurrenceId, string ETag,
    IReadOnlyList<EventSessionDto> Sessions, bool CanManage);
public sealed record SaveEventSessionRequest(LocalizedTextDto Title, DateTime StartUtc, DateTime EndUtc,
    string? PlaceJson, Guid? LeadMemberId, EventSessionStatus Status = EventSessionStatus.Draft);
public sealed record SaveEventProgramItemRequest(LocalizedTextDto Title, LocalizedTextDto? Description,
    int StartOffsetMinutes, int DurationMinutes, Guid? OwnerMemberId);
public sealed record ReorderEventProgramItemsRequest(IReadOnlyList<Guid> ItemIds);

public sealed record EventServiceSlotDto(Guid Id, Guid OccurrenceId, Guid? SessionId, Guid? ProgramItemId,
    Guid? ZoneId, string RoleCode, DateTime StartUtc, DateTime EndUtc, int RequiredCount,
    string EligibilityCode, int ConfirmedCount, IReadOnlyList<EventRosterAssignmentDto> Assignments,
    EventAvailabilityStatus? MyAvailability, LocalizedTextDto? RoleLabel = null);
public sealed record EventRosterAssignmentDto(Guid Id, Guid ServiceSlotId, Guid MemberId,
    EventRosterAssignmentStatus Status, Guid? ReplacesAssignmentId, DateTime? ConfirmedUtc,
    DateTime? DeclinedUtc, DateTime? EndedUtc);
public sealed record EventRosterDto(Guid EventId, Guid OccurrenceId, string ETag,
    IReadOnlyList<EventServiceSlotDto> Slots, IReadOnlyList<LocalizedTextDto> ReadinessBlockers, bool CanManage);
public sealed record SaveEventServiceSlotRequest(Guid? SessionId, Guid? ProgramItemId, Guid? ZoneId,
    string RoleCode, DateTime StartUtc, DateTime EndUtc, int RequiredCount, string EligibilityCode);
public sealed record SetEventAvailabilityRequest(EventAvailabilityStatus Status);
public sealed record AssignEventRosterMemberRequest(Guid MemberId, Guid? ReplacesAssignmentId = null);
