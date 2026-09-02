using Alife.Domain.Enums;

namespace Alife.Domain.Entities;

public sealed class EventPackageGovernancePolicyVersion
{
    public Guid Id { get; set; }
    public Guid? OrganisationId { get; set; }
    public string Version { get; set; } = string.Empty;
    public string SchemaVersion { get; set; } = "1";
    public string RulesJson { get; set; } = "{}";
    public EventPackageEnforcementMode EnforcementMode { get; set; } = EventPackageEnforcementMode.Off;
    public DateTime EffectiveFromUtc { get; set; }
    public DateTime? RetiredUtc { get; set; }
    public bool IsPublished { get; set; }
    public Guid PublishedByMemberId { get; set; }
    public DateTime PublishedUtc { get; set; }

    public Group? Organisation { get; set; }
    public Member PublishedByMember { get; set; } = null!;
    public ICollection<EventPackage> EventPackages { get; set; } = [];
}

public sealed class EventPackage
{
    public Guid Id { get; set; }
    public Guid EventId { get; set; }
    public EventPackageScopeType ScopeType { get; set; } = EventPackageScopeType.Event;
    public Guid? ScopeId { get; set; }
    public EventPackageCoverageMode CoverageMode { get; set; } = EventPackageCoverageMode.ExplicitOccurrences;
    public string CoveredOccurrenceIdsJson { get; set; } = "[]";
    public int Version { get; set; }
    public int EventPlanVersion { get; set; }
    public string PackageSchemaVersion { get; set; } = "1.0";
    public Guid GovernancePolicyVersionId { get; set; }
    public string GovernancePolicyVersion { get; set; } = string.Empty;
    public EventGovernanceTier GovernanceTier { get; set; }
    public EventPackageStatus Status { get; set; } = EventPackageStatus.Draft;
    public EventPackageApprovalValidity ApprovalValidityStatus { get; set; } = EventPackageApprovalValidity.NotDecided;
    public string ContentHash { get; set; } = string.Empty;
    public string SourceVectorHash { get; set; } = string.Empty;
    public string ManifestJson { get; set; } = "{}";
    public Guid? SupersedesPackageId { get; set; }
    public Guid GeneratedByMemberId { get; set; }
    public DateTime GeneratedUtc { get; set; }
    public Guid? SubmittedByMemberId { get; set; }
    public DateTime? SubmittedUtc { get; set; }
    public Guid ConcurrencyToken { get; set; } = Guid.NewGuid();

    public GroupEvent Event { get; set; } = null!;
    public EventOccurrence? ScopeOccurrence { get; set; }
    public EventPackageGovernancePolicyVersion GovernancePolicy { get; set; } = null!;
    public EventPackage? SupersedesPackage { get; set; }
    public Member GeneratedByMember { get; set; } = null!;
    public Member? SubmittedByMember { get; set; }
    public ICollection<EventPackageSourceReference> SourceReferences { get; set; } = [];
    public ICollection<EventPackageDecision> Decisions { get; set; } = [];
    public ICollection<EventPackageCondition> Conditions { get; set; } = [];
}

public sealed class EventPackageDecision
{
    public Guid Id { get; set; }
    public Guid EventPackageId { get; set; }
    public EventPackageDecisionType DecisionType { get; set; }
    public Guid ActorMemberId { get; set; }
    public string ReasonEn { get; set; } = string.Empty;
    public string ReasonZh { get; set; } = string.Empty;
    public DateTime DecidedUtc { get; set; }
    public string DecisionAuthoritySnapshotJson { get; set; } = "{}";
    public DateTime EffectiveUtc { get; set; }
    public DateTime? ExpiresUtc { get; set; }
    public Guid? RevokedByDecisionId { get; set; }
    public string? InvalidatedReasonCode { get; set; }
    public string RequestHash { get; set; } = string.Empty;

    public EventPackage EventPackage { get; set; } = null!;
    public Member ActorMember { get; set; } = null!;
    public EventPackageDecision? RevokedByDecision { get; set; }
    public ICollection<EventPackageCondition> WaivedConditions { get; set; } = [];
}

public sealed class EventPackageCondition
{
    public Guid Id { get; set; }
    public Guid EventPackageId { get; set; }
    public Guid? ReadinessTaskId { get; set; }
    public string TextEn { get; set; } = string.Empty;
    public string TextZh { get; set; } = string.Empty;
    public EventLifecycleGate AppliesToGate { get; set; }
    public string OwnerRoleRequirementKey { get; set; } = string.Empty;
    public DateTime DueUtc { get; set; }
    public EventPackageConditionStatus Status { get; set; } = EventPackageConditionStatus.Open;
    public DateTime? ExpiredUtc { get; set; }
    public Guid? WaivedByDecisionId { get; set; }
    public string? EvidenceReference { get; set; }
    public string? EvidenceReferenceHash { get; set; }
    public DateTime? EvidenceExpiresUtc { get; set; }
    public DateTime? EvidenceUnavailableUtc { get; set; }
    public Guid? SatisfiedByMemberId { get; set; }
    public DateTime? SatisfiedUtc { get; set; }
    public Guid? VerifiedByMemberId { get; set; }
    public DateTime? VerifiedUtc { get; set; }
    public Guid ConcurrencyToken { get; set; } = Guid.NewGuid();

    public EventPackage EventPackage { get; set; } = null!;
    public EventTask? ReadinessTask { get; set; }
    public EventPackageDecision? WaivedByDecision { get; set; }
    public Member? SatisfiedByMember { get; set; }
    public Member? VerifiedByMember { get; set; }
}

public sealed class EventPackageSourceReference
{
    public Guid Id { get; set; }
    public Guid EventPackageId { get; set; }
    public string ModuleCode { get; set; } = string.Empty;
    public string SubjectType { get; set; } = string.Empty;
    public Guid SubjectId { get; set; }
    public string SubjectVersion { get; set; } = string.Empty;
    public Guid? SourceDecisionId { get; set; }
    public DateTime? ValidUntilUtc { get; set; }
    public string DataClass { get; set; } = string.Empty;
    public bool RequiredForDecision { get; set; }
    public DateTime CapturedUtc { get; set; }

    public EventPackage EventPackage { get; set; } = null!;
}

public sealed class EventPackageApprovalDelegation
{
    public Guid Id { get; set; }
    public Guid OrganisationId { get; set; }
    public EventPackageDelegationScopeType ScopeType { get; set; }
    public Guid? ScopeId { get; set; }
    public string PermissionCode { get; set; } = "event.package.decide";
    public Guid DelegatedToMemberId { get; set; }
    public DateTime StartsUtc { get; set; }
    public DateTime ExpiresUtc { get; set; }
    public Guid GrantedByMemberId { get; set; }
    public DateTime GrantedUtc { get; set; }
    public Guid? RevokedByMemberId { get; set; }
    public DateTime? RevokedUtc { get; set; }
    public string? RevocationReasonEn { get; set; }
    public string? RevocationReasonZh { get; set; }
    public Guid ConcurrencyToken { get; set; } = Guid.NewGuid();

    public Group Organisation { get; set; } = null!;
    public Member DelegatedToMember { get; set; } = null!;
    public Member GrantedByMember { get; set; } = null!;
    public Member? RevokedByMember { get; set; }
}
