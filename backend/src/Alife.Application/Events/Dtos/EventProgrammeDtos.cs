using Alife.Domain.Enums;

namespace Alife.Application.Events.Dtos;

public sealed record EventProgrammeOccurrenceDto(
    Guid Id,
    WorkflowTextDto Name,
    DateTime StartUtc,
    DateTime EndUtc,
    string TimeZoneId);

public sealed record EventProgrammeMemberDto(Guid Id, string DisplayName);

public sealed record EventProgrammeAssigneeDto(
    Guid MemberId,
    string DisplayName,
    EventRosterAssignmentStatus Status);

public sealed record EventProgrammeRosterLinkDto(
    Guid ShiftId,
    string RoleKey,
    WorkflowTextDto Name,
    IReadOnlyList<EventProgrammeAssigneeDto> Assignees);

public sealed record EventProgrammeRosterOptionDto(
    Guid ShiftId,
    WorkflowTextDto Name,
    DateTime StartUtc,
    DateTime EndUtc,
    IReadOnlyList<EventProgrammeAssigneeDto> Assignees);

public sealed record EventProgrammeItemDto(
    Guid Id,
    Guid? EventOccurrenceId,
    Guid? RosterShiftId,
    Guid? OwnerMemberId,
    string? OwnerDisplayName,
    int SortOrder,
    DateTime StartUtc,
    DateTime EndUtc,
    WorkflowTextDto Title,
    WorkflowTextDto Instructions,
    bool RequiresHandover,
    WorkflowTextDto Handover,
    EventProgrammeItemStatus Status,
    bool CanBeReady,
    EventProgrammeRosterLinkDto? Roster,
    DateTime UpdatedUtc);

public sealed record EventProgrammeWorkspaceDto(
    Guid EventId,
    Guid GroupId,
    WorkflowTextDto EventTitle,
    DateTime EventStartUtc,
    DateTime EventEndUtc,
    EventModuleStatus Status,
    IReadOnlyList<EventProgrammeOccurrenceDto> Occurrences,
    IReadOnlyList<EventProgrammeMemberDto> Members,
    IReadOnlyList<EventProgrammeRosterOptionDto> RosterOptions,
    IReadOnlyList<EventProgrammeItemDto> Items);
