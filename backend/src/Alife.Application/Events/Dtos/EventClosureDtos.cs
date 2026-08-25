namespace Alife.Application.Events.Dtos;

public sealed record EventClosureLearningDto(
    Guid Id,
    WorkflowTextDto Title,
    WorkflowTextDto Detail,
    bool ReuseNextTime);

public sealed record EventClosureSourceLearningDto(
    Guid EventId,
    WorkflowTextDto EventTitle,
    DateTime EventEndUtc,
    EventClosureLearningDto Learning);

public sealed record EventClosureReportDto(
    WorkflowTextDto Summary,
    string AttendanceNotes,
    string FinanceNotes,
    string IncidentNotes,
    string FollowUpNotes,
    IReadOnlyList<EventClosureLearningDto> Learnings,
    bool LeaderConfirmed,
    Guid? ConfirmedByMemberId,
    string? ConfirmedByDisplayName,
    DateTime? ConfirmedUtc,
    DateTime? UpdatedUtc);

public sealed record EventClosureEvidenceDto(
    int EnrollmentSubmissions,
    int AcceptedRosterAssignments,
    int RequiredRosterAssignments,
    int MemberReviews,
    int ActualAttendanceUnits,
    bool AttendanceRecorded,
    decimal ActualIncome,
    decimal ActualExpense,
    bool FinanceReconciled);

public sealed record EventClosureWorkspaceDto(
    Guid EventId,
    Guid GroupId,
    WorkflowTextDto EventTitle,
    DateTime EventEndUtc,
    bool EventHasEnded,
    EventClosureEvidenceDto Evidence,
    EventClosureReportDto Report,
    IReadOnlyList<EventClosureSourceLearningDto> PreviousLearnings);
