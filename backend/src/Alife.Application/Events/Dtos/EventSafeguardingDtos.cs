using Alife.Domain.Enums;

namespace Alife.Application.Events.Dtos;

public sealed record EventSafeguardingPolicySummaryDto(
    Guid Id, string PolicyCode, int Version, LocalizedTextDto Name,
    DateTime EffectiveFromUtc, DateTime? RetiredUtc, bool RequirementsRecognized);

public sealed record EventSafeguardingReadinessDto(
    bool CurrentPolicyLoaded,
    bool GuardianshipComplete,
    bool EligibleWorkersSatisfied,
    IReadOnlyList<LocalizedTextDto> Blockers,
    DateTime CheckedUtc);

public sealed record EventChildGuardianDto(
    Guid Id, Guid GuardianMemberId, string GuardianDisplayName, string RelationshipLabel,
    EventGuardianRelationshipStatus Status, string ETag);

public sealed record EventChildCollectorDto(
    Guid Id, string DisplayName, string RelationshipLabel, bool IsActive, string ETag);

public sealed record EventChildAttendanceDto(
    Guid Id, Guid EventOccurrenceId, EventChildAttendanceState State,
    DateTime CheckedInUtc, DateTime? CheckedOutUtc,
    Guid? CollectorId, string? CollectorDisplayName, string ETag);

public sealed record EventSafeguardingChildDto(
    Guid Id, Guid? RegistrationParticipantId, Guid? ChildMemberId, string DisplayName, string? PhotoUrl,
    bool ConsentCurrent, bool AuthorisedCollectionComplete,
    IReadOnlyList<EventChildGuardianDto> Guardians,
    IReadOnlyList<EventChildCollectorDto> AuthorisedCollectors,
    EventChildAttendanceDto? Attendance,
    string ETag);

public sealed record EventSafeguardingWorkerEvidenceDto(
    Guid Id, Guid MemberId, string MemberDisplayName, string RoleRequirementKey,
    string EligibilityEvidenceCode, string EvidenceReference, bool IsEligible,
    Guid VerifiedByMemberId, DateTime VerifiedUtc, string ETag);

public sealed record EventSafeguardingAuditDto(
    Guid Id, string Action, Guid? ChildRegistrationId, Guid ActorMemberId,
    DateTime OccurredUtc);

public sealed record EventSafeguardingMemberOptionDto(Guid MemberId, string DisplayName);
public sealed record EventSafeguardingRegistrationParticipantOptionDto(Guid RegistrationParticipantId, Guid? MemberId, string DisplayName);

public sealed record EventSafeguardingWorkspaceDto(
    Guid EventId,
    Guid? SelectedOccurrenceId,
    string AccessMode,
    EventSafeguardingPolicySummaryDto? SelectedPolicy,
    IReadOnlyList<EventSafeguardingPolicySummaryDto> AvailablePolicies,
    IReadOnlyList<EventOccurrenceDto> Occurrences,
    IReadOnlyList<EventSafeguardingRegistrationParticipantOptionDto> RegistrationParticipantOptions,
    IReadOnlyList<EventSafeguardingMemberOptionDto> MemberOptions,
    IReadOnlyList<EventSafeguardingChildDto> Children,
    IReadOnlyList<EventSafeguardingWorkerEvidenceDto> WorkerEvidence,
    IReadOnlyList<EventSafeguardingAuditDto> Audit,
    EventSafeguardingReadinessDto Readiness,
    string ConfigurationETag,
    string DataClassification);

public sealed record EventSafeguardingMyChildDto(
    Guid ChildRegistrationId, Guid? ChildMemberId, Guid RegistrationParticipantId, string DisplayName, string? PhotoUrl,
    bool IsGuardian, Guid? GuardianRelationshipId, string? GuardianETag,
    EventGuardianRelationshipStatus? GuardianStatus,
    bool ConsentCurrent, IReadOnlyList<EventChildCollectorDto> AuthorisedCollectors,
    IReadOnlyList<EventChildAttendanceDto> Attendance);

public sealed record EventSafeguardingMyContextDto(
    Guid EventId, IReadOnlyList<EventSafeguardingMyChildDto> Children, string DataClassification);

public sealed record ConfigureEventSafeguardingRequest(Guid PolicyVersionId);
public sealed record CreateEventChildRegistrationRequest(Guid RegistrationParticipantId, string? PhotoUrl = null);
public sealed record CreateEventChildGuardianRequest(Guid GuardianMemberId, string RelationshipLabel);
public sealed record RecordEventChildConsentRequest(EventGuardianConsentDecision Decision);
public sealed record CreateEventChildCollectorRequest(string DisplayName, string RelationshipLabel);
public sealed record SaveEventSafeguardingWorkerEvidenceRequest(
    Guid MemberId, string RoleRequirementKey, string EligibilityEvidenceCode,
    string EvidenceReference, bool IsEligible);
public sealed record CheckOutEventChildRequest(Guid CollectorId);
