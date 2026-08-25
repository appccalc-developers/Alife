namespace Alife.Application.Events.Dtos;

public sealed record EventFinanceOptionDto(string Id, WorkflowTextDto Name, decimal ExtraFee);
public sealed record EventPaymentEvidenceSummaryDto(
    Guid EnrollmentId,
    string ApplicantName,
    int FileCount,
    DateTime UpdatedUtc);
public sealed record EventFinanceEntryDto(
    Guid Id,
    string Type,
    string Category,
    WorkflowTextDto Description,
    decimal Amount,
    DateTime OccurredUtc,
    DateTime UpdatedUtc);
public sealed record EventFinanceReconciliationDto(
    WorkflowTextDto Notes,
    bool LeaderConfirmed,
    Guid? ConfirmedByMemberId,
    string? ConfirmedByMemberName,
    DateTime? ConfirmedUtc,
    DateTime? UpdatedUtc);
public sealed record EventFinanceWorkspaceDto(
    Guid EventId,
    Guid GroupId,
    string TitleEn,
    string TitleZh,
    string Status,
    string Currency,
    decimal? AdultFee,
    decimal? ChildFee,
    WorkflowTextDto PaymentInstructions,
    WorkflowTextDto RefundPolicy,
    bool PaymentEvidenceRequired,
    bool LeaderConfirmed,
    IReadOnlyList<EventFinanceOptionDto> Options,
    int EvidenceSubmissionCount,
    int EvidenceFileCount,
    IReadOnlyList<EventPaymentEvidenceSummaryDto> EvidenceSummaries,
    bool EventEnded,
    decimal ActualIncome,
    decimal ActualExpense,
    decimal ActualBalance,
    IReadOnlyList<EventFinanceEntryDto> ActualEntries,
    EventFinanceReconciliationDto Reconciliation);
