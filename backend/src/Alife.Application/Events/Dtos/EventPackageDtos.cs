using Alife.Domain.Enums;

namespace Alife.Application.Events.Dtos;

public sealed record GenerateEventPackageRequest(
    EventPackageScopeType ScopeType = EventPackageScopeType.Event,
    Guid? ScopeId = null,
    string PackageSchemaVersion = "1.0");

public sealed record ListEventPackagesRequest(
    int Page = 1,
    int PageSize = 20,
    EventPackageStatus? Status = null,
    EventPackageScopeType? ScopeType = null,
    Guid? ScopeId = null,
    string Sort = "versionDesc");

public sealed record EventPackageSourceReferenceDto(
    string ModuleCode,
    string SubjectType,
    Guid SubjectId,
    string SubjectVersion,
    Guid? SourceDecisionId,
    DateTime? ValidUntilUtc,
    string DataClass,
    bool RequiredForDecision,
    DateTime CapturedUtc);

public sealed record EventPackageModuleSummaryDto(
    string ModuleCode,
    string PlanStatus,
    string Availability,
    string SourceVersion,
    IReadOnlyList<LocalizedTextDto> Blockers);

public sealed record EventPackageReasonDto(string Code, LocalizedTextDto Message);

public sealed record EventPackageSectionDto(
    string Code,
    LocalizedTextDto Title,
    string Status,
    IReadOnlyList<LocalizedTextDto> Items,
    IReadOnlyList<string> ModuleCodes,
    IReadOnlyList<LocalizedTextDto> Blockers);

public sealed record EventPackageManifestDto(
    string PackageSchemaVersion,
    Guid EventId,
    EventPackageScopeType ScopeType,
    Guid? ScopeId,
    EventPackageCoverageMode CoverageMode,
    IReadOnlyList<Guid> CoveredOccurrenceIds,
    int EventPlanVersion,
    string GovernancePolicyVersion,
    EventGovernanceTier GovernanceTier,
    LegacyEventPackageTransition LegacyTransition,
    LocalizedTextDto EventTitle,
    DateTime StartUtc,
    DateTime EndUtc,
    IReadOnlyList<EventPackageModuleSummaryDto> Modules,
    IReadOnlyList<LocalizedTextDto> Blockers)
{
    public IReadOnlyList<EventPackageReasonDto> TriggerReasons { get; init; } = [];
    public IReadOnlyList<string> RequiredSpecialistDecisions { get; init; } = [];
    public IReadOnlyList<EventPackageSectionDto> Sections { get; init; } = [];
    public IReadOnlyList<LocalizedTextDto> Warnings { get; init; } = [];
}

public sealed record EventPackageConditionInput(
    LocalizedTextDto Text,
    EventLifecycleGate AppliesToGate,
    string OwnerRoleRequirementKey,
    DateTime DueUtc);

public sealed record EventPackageDecisionRequest(
    EventPackageDecisionType DecisionType,
    LocalizedTextDto Reason,
    DateTime? ExpiresUtc = null,
    IReadOnlyList<EventPackageConditionInput>? Conditions = null);

public sealed record EventPackageDecisionDto(
    Guid Id,
    EventPackageDecisionType DecisionType,
    Guid ActorMemberId,
    LocalizedTextDto Reason,
    DateTime DecidedUtc,
    DateTime EffectiveUtc,
    DateTime? ExpiresUtc,
    Guid? RevokedByDecisionId,
    string? InvalidatedReasonCode);

public sealed record EventPackageConditionDto(
    Guid Id,
    Guid? ReadinessTaskId,
    LocalizedTextDto Text,
    EventLifecycleGate AppliesToGate,
    string OwnerRoleRequirementKey,
    DateTime DueUtc,
    EventPackageConditionStatus Status,
    DateTime? ExpiredUtc,
    string? EvidenceReference,
    string? EvidenceReferenceHash,
    DateTime? EvidenceExpiresUtc,
    DateTime? EvidenceUnavailableUtc,
    bool EvidenceAvailable,
    Guid? SatisfiedByMemberId,
    DateTime? SatisfiedUtc,
    Guid? VerifiedByMemberId,
    DateTime? VerifiedUtc,
    string ETag);

public sealed record EventPackageDto(
    Guid Id,
    Guid EventId,
    EventPackageScopeType ScopeType,
    Guid? ScopeId,
    EventPackageCoverageMode CoverageMode,
    IReadOnlyList<Guid> CoveredOccurrenceIds,
    int Version,
    int EventPlanVersion,
    string PackageSchemaVersion,
    string GovernancePolicyVersion,
    EventGovernanceTier GovernanceTier,
    EventPackageStatus Status,
    EventPackageApprovalValidity ApprovalValidityStatus,
    string ContentHash,
    string SourceVectorHash,
    EventPackageManifestDto Manifest,
    IReadOnlyList<EventPackageSourceReferenceDto> SourceReferences,
    IReadOnlyList<EventPackageDecisionDto> Decisions,
    IReadOnlyList<EventPackageConditionDto> Conditions,
    Guid? SupersedesPackageId,
    Guid GeneratedByMemberId,
    DateTime GeneratedUtc,
    string ETag);

public sealed record EventPackagePageDto(
    IReadOnlyList<EventPackageDto> Items,
    int Page,
    int PageSize,
    int TotalCount);

public sealed record EventPackageDiffFieldDto(
    string Field,
    string? Before,
    string? After,
    string Classification,
    IReadOnlyList<string> AffectedModuleCodes);

public sealed record EventPackageDiffDto(
    Guid FromPackageId,
    int FromVersion,
    Guid ToPackageId,
    int ToVersion,
    bool HasMaterialChanges,
    IReadOnlyList<EventPackageDiffFieldDto> Changes);

public sealed record EventPackageConditionActorCapabilitiesDto(
    Guid ConditionId,
    bool CanSatisfy,
    bool CanVerify,
    bool CanWaive);

public sealed record EventPackageActorCapabilitiesDto(
    Guid EventId,
    Guid PackageId,
    bool CanGenerate,
    bool CanSubmit,
    bool CanWithdraw,
    bool CanDecide,
    bool CanRevokeDecision,
    bool CanPublish,
    bool CanUnpublish,
    bool CanOpenRegistration,
    bool CanCloseRegistration,
    bool CanConfirmExecution,
    bool CanManageDelegations,
    IReadOnlyList<EventPackageConditionActorCapabilitiesDto> Conditions);

public sealed record EventLifecycleGateBlockerDto(
    string Code,
    LocalizedTextDto Message,
    string ResponsibleRole,
    string NextAction);

public sealed record EventLifecycleGateEvaluationDto(
    EventLifecycleGate Gate,
    EventPackageEnforcementMode EnforcementMode,
    EventPackageScopeType ScopeType,
    Guid? ScopeId,
    bool Allowed,
    bool RequirementsSatisfied,
    DateTime EvaluatedUtc,
    int? EventPlanVersion,
    int? EventPackageVersion,
    string? GovernancePolicyVersion,
    IReadOnlyList<EventLifecycleGateBlockerDto> Blockers,
    IReadOnlyList<EventLifecycleGateBlockerDto> Warnings);

public sealed record EventLifecycleDto(
    Guid EventId,
    EventPublicationStatus PublicationStatus,
    Guid? PublishedPackageId,
    DateTime? PublishedUtc,
    EventPackageEnforcementMode GateMode,
    bool PublishGateSatisfied,
    IReadOnlyList<string> ReasonCodes,
    string ETag,
    EventRegistrationStatus RegistrationStatus,
    Guid? RegistrationPackageId,
    DateTime? RegistrationOpenedUtc,
    EventPackageEnforcementMode RegistrationGateMode,
    bool RegistrationGateSatisfied,
    IReadOnlyList<string> RegistrationReasonCodes,
    string RegistrationETag,
    EventExecutionStatus ExecutionStatus,
    Guid? ExecutionPackageId,
    DateTime? ExecutionConfirmedUtc,
    EventPackageEnforcementMode ExecutionGateMode,
    bool ExecutionGateSatisfied,
    IReadOnlyList<string> ExecutionReasonCodes,
    string ExecutionETag,
    bool PaymentGateSatisfied,
    IReadOnlyList<string> PaymentReasonCodes,
    IReadOnlyList<EventLifecycleGateEvaluationDto> Gates);

public sealed record PublishEventRequest(Guid? PackageId, string? PackageETag, string EventETag);
public sealed record UnpublishEventRequest(LocalizedTextDto Reason, string EventETag);
public sealed record RevokeEventPackageDecisionRequest(LocalizedTextDto Reason);
public sealed record SatisfyEventPackageConditionRequest(string EvidenceReference);
public sealed record VerifyEventPackageConditionRequest(bool Verified, LocalizedTextDto Reason);
public sealed record WaiveEventPackageConditionRequest(LocalizedTextDto Reason);
public sealed record EventPackageConditionResultDto(EventPackageConditionDto Condition, EventLifecycleDto Lifecycle);
public sealed record OpenEventRegistrationRequest(Guid? PackageId, string? PackageETag, string RegistrationETag);
public sealed record CloseEventRegistrationRequest(LocalizedTextDto Reason, string RegistrationETag);
public sealed record ConfirmEventExecutionRequest(
    EventPackageScopeType ScopeType,
    Guid? ScopeId,
    Guid PackageId,
    string PackageETag,
    string ExecutionETag);
