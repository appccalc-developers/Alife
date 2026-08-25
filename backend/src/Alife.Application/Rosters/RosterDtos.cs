using Alife.Domain.Enums;
using Alife.Application.Events.Dtos;

namespace Alife.Application.Rosters;

public sealed record SchedulingUnavailableWindowDto(
    IReadOnlyList<int> DaysOfWeek,
    string StartLocalTime,
    string EndLocalTime,
    string Reason);

public sealed record SelfSchedulingProfileDto(
    Guid GroupId,
    Guid MemberId,
    IReadOnlyList<string> PreferredRoleKeys,
    IReadOnlyList<SchedulingUnavailableWindowDto> UnavailableWindows,
    int MaxAssignmentsPerDay,
    string SelfNotes,
    DateTime? UpdatedUtc);

public sealed record ManagerSchedulingProfileDto(
    IReadOnlyList<string> Labels,
    IReadOnlyList<SchedulingUnavailableWindowDto> UnavailableWindows,
    string ConfirmationStatus,
    string ConfirmationMethod,
    DateTime? ConfirmedUtc,
    DateTime? ReviewDueUtc,
    IReadOnlyList<ManagerQualificationDto> Qualifications);

public sealed record ManagerQualificationDto(
    string Key,
    DateTime? ValidUntilUtc);

public sealed record RosterCapabilityDto(
    Guid Id,
    Guid GroupId,
    string Key,
    WorkflowTextDto Name,
    WorkflowTextDto Description,
    bool RequiresExpiry,
    int? DefaultValidityDays,
    bool IsActive,
    DateTime UpdatedUtc);

public sealed record RosterMemberDto(
    Guid MemberId,
    string DisplayName,
    IReadOnlyList<string> PreferredRoleKeys,
    IReadOnlyList<SchedulingUnavailableWindowDto> UnavailableWindows,
    int MaxAssignmentsPerDay,
    string SelfNotes,
    IReadOnlyList<string> ManagerLabels,
    string ManagerNotes,
    IReadOnlyList<SchedulingUnavailableWindowDto> ManagerUnavailableWindows,
    string ManagerConfirmationStatus,
    string ManagerConfirmationMethod,
    DateTime? ManagerConfirmedUtc,
    DateTime? ManagerReviewDueUtc,
    IReadOnlyList<ManagerQualificationDto> ManagerQualifications);

public sealed record RosterAssignmentDto(
    Guid Id,
    Guid MemberId,
    string DisplayName,
    EventRosterAssignmentStatus Status,
    bool BasedOnSmartSuggestion,
    string ConfirmationNotes,
    DateTime ConfirmedUtc,
    string MemberResponseNotes,
    DateTime? RespondedUtc);

public sealed record RosterShiftDto(
    Guid Id,
    string RoleKey,
    WorkflowTextDto Name,
    DateTime StartUtc,
    DateTime EndUtc,
    int RequiredPeople,
    IReadOnlyList<string> RequiredLabels,
    string Notes,
    IReadOnlyList<RosterAssignmentDto> Assignments);

public sealed record EventRosterWorkspaceDto(
    Guid EventId,
    Guid GroupId,
    WorkflowTextDto EventTitle,
    DateTime EventStartUtc,
    DateTime EventEndUtc,
    IReadOnlyList<RosterCapabilityDto> CapabilityCatalog,
    IReadOnlyList<RosterMemberDto> Members,
    IReadOnlyList<RosterShiftDto> Shifts);

public sealed record RosterCandidateSuggestionDto(
    Guid MemberId,
    string DisplayName,
    int Score,
    bool Eligible,
    IReadOnlyList<RosterSuggestionReasonDto> Reasons,
    int RecentAssignmentCount,
    int PastSameRoleCount,
    int ConsecutiveServiceWeeks,
    DateTime? LastAssignedUtc);

public sealed record RosterSuggestionReasonDto(
    string Code,
    WorkflowTextDto Text,
    string Severity);

public sealed record RosterPlanAssignmentSuggestionDto(
    Guid ShiftId,
    Guid MemberId,
    string DisplayName,
    int Score,
    int RecentAssignmentCount,
    int PastSameRoleCount,
    int ConsecutiveServiceWeeks,
    IReadOnlyList<RosterSuggestionReasonDto> Reasons);

public sealed record RosterPlanShiftSuggestionDto(
    Guid ShiftId,
    string RoleKey,
    WorkflowTextDto Name,
    DateTime StartUtc,
    DateTime EndUtc,
    int RequiredPeople,
    int AlreadyProposedOrAccepted,
    IReadOnlyList<RosterPlanAssignmentSuggestionDto> SuggestedAssignments,
    int UnfilledCount,
    WorkflowTextDto? GapExplanation);

public sealed record RosterPlanSchemeDto(
    string Key,
    WorkflowTextDto Name,
    WorkflowTextDto Description,
    int FilledCount,
    int UnfilledCount,
    IReadOnlyList<RosterPlanShiftSuggestionDto> Shifts);

public sealed record EventRosterPlanOptionsDto(
    Guid EventId,
    DateTime GeneratedUtc,
    IReadOnlyList<RosterPlanSchemeDto> Schemes);

public sealed record MyRosterAssignmentDto(
    Guid Id,
    Guid ShiftId,
    string RoleKey,
    WorkflowTextDto ShiftName,
    DateTime StartUtc,
    DateTime EndUtc,
    EventRosterAssignmentStatus Status,
    DateTime ConfirmedUtc,
    string MemberResponseNotes,
    DateTime? RespondedUtc);

public sealed record MyEventRosterWorkspaceDto(
    Guid EventId,
    Guid GroupId,
    WorkflowTextDto EventTitle,
    IReadOnlyList<MyRosterAssignmentDto> Assignments);
