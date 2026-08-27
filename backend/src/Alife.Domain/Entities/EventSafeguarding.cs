using Alife.Domain.Enums;

namespace Alife.Domain.Entities;

public sealed class EventSafeguardingPolicyVersion
{
    public Guid Id { get; set; }
    public Guid GroupId { get; set; }
    public string PolicyCode { get; set; } = string.Empty;
    public int Version { get; set; }
    public string NameEn { get; set; } = string.Empty;
    public string NameZh { get; set; } = string.Empty;
    public string RequirementsJson { get; set; } = "{}";
    public bool IsPublished { get; set; }
    public DateTime EffectiveFromUtc { get; set; }
    public DateTime? RetiredUtc { get; set; }
    public Guid CreatedByMemberId { get; set; }
    public DateTime CreatedUtc { get; set; }

    public Group Group { get; set; } = null!;
    public Member CreatedByMember { get; set; } = null!;
}

public sealed class EventSafeguardingConfiguration
{
    public Guid Id { get; set; }
    public Guid EventId { get; set; }
    public Guid PolicyVersionId { get; set; }
    public Guid ConfiguredByMemberId { get; set; }
    public DateTime ConfiguredUtc { get; set; }
    public Guid ConcurrencyToken { get; set; } = Guid.NewGuid();

    public GroupEvent Event { get; set; } = null!;
    public EventSafeguardingPolicyVersion PolicyVersion { get; set; } = null!;
    public Member ConfiguredByMember { get; set; } = null!;
}

public sealed class EventChildRegistration
{
    public Guid Id { get; set; }
    public Guid EventId { get; set; }
    public Guid EnrollmentId { get; set; }
    public Guid ChildMemberId { get; set; }
    public string? PhotoUrl { get; set; }
    public bool IsActive { get; set; } = true;
    public Guid CreatedByMemberId { get; set; }
    public DateTime CreatedUtc { get; set; }
    public Guid? EndedByMemberId { get; set; }
    public DateTime? EndedUtc { get; set; }
    public Guid ConcurrencyToken { get; set; } = Guid.NewGuid();

    public GroupEvent Event { get; set; } = null!;
    public EventEnrollment Enrollment { get; set; } = null!;
    public Member ChildMember { get; set; } = null!;
    public Member CreatedByMember { get; set; } = null!;
    public Member? EndedByMember { get; set; }
    public ICollection<EventChildGuardianRelationship> Guardians { get; set; } = [];
    public ICollection<EventChildConsentRecord> ConsentRecords { get; set; } = [];
    public ICollection<EventChildAuthorisedCollector> AuthorisedCollectors { get; set; } = [];
    public ICollection<EventChildAttendance> AttendanceRecords { get; set; } = [];
}

public sealed class EventChildGuardianRelationship
{
    public Guid Id { get; set; }
    public Guid ChildRegistrationId { get; set; }
    public Guid GuardianMemberId { get; set; }
    public string RelationshipLabel { get; set; } = string.Empty;
    public EventGuardianRelationshipStatus Status { get; set; } = EventGuardianRelationshipStatus.Pending;
    public Guid CreatedByMemberId { get; set; }
    public DateTime CreatedUtc { get; set; }
    public DateTime? ConfirmedUtc { get; set; }
    public DateTime? EndedUtc { get; set; }
    public Guid ConcurrencyToken { get; set; } = Guid.NewGuid();

    public EventChildRegistration ChildRegistration { get; set; } = null!;
    public Member GuardianMember { get; set; } = null!;
    public Member CreatedByMember { get; set; } = null!;
    public ICollection<EventChildConsentRecord> ConsentRecords { get; set; } = [];
    public ICollection<EventChildAuthorisedCollector> AuthorisedCollectors { get; set; } = [];
}

public sealed class EventChildConsentRecord
{
    public Guid Id { get; set; }
    public Guid ChildRegistrationId { get; set; }
    public Guid GuardianRelationshipId { get; set; }
    public Guid PolicyVersionId { get; set; }
    public EventGuardianConsentDecision Decision { get; set; }
    public Guid RecordedByMemberId { get; set; }
    public DateTime RecordedUtc { get; set; }

    public EventChildRegistration ChildRegistration { get; set; } = null!;
    public EventChildGuardianRelationship GuardianRelationship { get; set; } = null!;
    public EventSafeguardingPolicyVersion PolicyVersion { get; set; } = null!;
    public Member RecordedByMember { get; set; } = null!;
}

public sealed class EventChildAuthorisedCollector
{
    public Guid Id { get; set; }
    public Guid ChildRegistrationId { get; set; }
    public Guid AuthorisedByGuardianRelationshipId { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public string RelationshipLabel { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTime AuthorisedUtc { get; set; }
    public Guid? RevokedByMemberId { get; set; }
    public DateTime? RevokedUtc { get; set; }
    public Guid ConcurrencyToken { get; set; } = Guid.NewGuid();

    public EventChildRegistration ChildRegistration { get; set; } = null!;
    public EventChildGuardianRelationship AuthorisedByGuardianRelationship { get; set; } = null!;
    public Member? RevokedByMember { get; set; }
    public ICollection<EventChildAttendance> CollectionRecords { get; set; } = [];
}

public sealed class EventChildAttendance
{
    public Guid Id { get; set; }
    public Guid EventId { get; set; }
    public Guid EventOccurrenceId { get; set; }
    public Guid ChildRegistrationId { get; set; }
    public EventChildAttendanceState State { get; set; } = EventChildAttendanceState.Present;
    public Guid CheckedInByMemberId { get; set; }
    public DateTime CheckedInUtc { get; set; }
    public Guid? CheckedOutByMemberId { get; set; }
    public DateTime? CheckedOutUtc { get; set; }
    public Guid? CollectorId { get; set; }
    public Guid ConcurrencyToken { get; set; } = Guid.NewGuid();

    public GroupEvent Event { get; set; } = null!;
    public EventOccurrence EventOccurrence { get; set; } = null!;
    public EventChildRegistration ChildRegistration { get; set; } = null!;
    public Member CheckedInByMember { get; set; } = null!;
    public Member? CheckedOutByMember { get; set; }
    public EventChildAuthorisedCollector? Collector { get; set; }
}

public sealed class EventSafeguardingWorkerEligibility
{
    public Guid Id { get; set; }
    public Guid EventId { get; set; }
    public Guid PolicyVersionId { get; set; }
    public Guid MemberId { get; set; }
    public string RoleRequirementKey { get; set; } = string.Empty;
    public string EligibilityEvidenceCode { get; set; } = string.Empty;
    public string EvidenceReference { get; set; } = string.Empty;
    public bool IsEligible { get; set; }
    public Guid VerifiedByMemberId { get; set; }
    public DateTime VerifiedUtc { get; set; }
    public Guid ConcurrencyToken { get; set; } = Guid.NewGuid();

    public GroupEvent Event { get; set; } = null!;
    public EventSafeguardingPolicyVersion PolicyVersion { get; set; } = null!;
    public Member Member { get; set; } = null!;
    public Member VerifiedByMember { get; set; } = null!;
}
