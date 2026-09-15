namespace Alife.Domain.Entities;

public sealed class EventRegistrationPolicy
{
    public Guid EventId { get; set; }
    public int Version { get; set; }
    public string RulesJson { get; set; } = "{}";
    public string FeeApprovalStatus { get; set; } = "notRequired";
    public Guid? FeeApprovedByMemberId { get; set; }
    public Guid? FeeSubmittedByMemberId { get; set; }
    public Guid ConcurrencyToken { get; set; } = Guid.NewGuid();
    public DateTime UpdatedUtc { get; set; }
    public GroupEvent Event { get; set; } = null!;
}
public sealed class EventRegistrationApplication
{
    public Guid Id { get; set; }
    public Guid EventId { get; set; }
    public Guid OrganiserMemberId { get; set; }
    public Guid CreatedByMemberId { get; set; }
    public string ManualOrganiserName { get; set; } = string.Empty;
    public string ProxyAuthorityEvidence { get; set; } = string.Empty;
    public Guid? LegacyEnrollmentId { get; set; }
    public bool AllowSplit { get; set; }
    public bool IsInvitation { get; set; }
    public string InvitationMode { get; set; } = "byDeadline";
    public DateTime? InvitedUtc { get; set; }
    public DateTime? ReservationExpiresUtc { get; set; }
    public int PolicyVersion { get; set; }
    public string Channel { get; set; } = "app";
    public DateTime QueuedUtc { get; set; }
    public Guid ConcurrencyToken { get; set; } = Guid.NewGuid();
    public GroupEvent Event { get; set; } = null!;
    public ICollection<EventRegistrationParticipant> Participants { get; set; } = [];
}
public sealed class EventRegistrationParticipant
{
    public Guid Id { get; set; }
    public Guid ApplicationId { get; set; }
    public Guid? MemberId { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public bool IsChild { get; set; }
    public string GuardianName { get; set; } = string.Empty;
    public Guid? GuardianMemberId { get; set; }
    public bool ProxyAccessRevoked { get; set; }
    public string SeatStatus { get; set; } = "draft";
    public string ProcedureStatus { get; set; } = "incomplete";
    public string ConsentMethod { get; set; } = string.Empty;
    public string ConsentEvidence { get; set; } = string.Empty;
    public DateTime? ConsentedUtc { get; set; }
    public Guid? ConsentRecordedByMemberId { get; set; }
    public bool EligibilityVerified { get; set; }
    public bool MaterialsVerified { get; set; }
    public string AnswersJson { get; set; } = "{}";
    public long PaidMinor { get; set; }
    public long RefundedMinor { get; set; }
    public bool IsLegacy { get; set; }
    public EventRegistrationApplication Application { get; set; } = null!;
}
public sealed class EventRegistrationAction
{
    public Guid Id { get; set; }
    public Guid EventId { get; set; }
    public Guid? ApplicationId { get; set; }
    public Guid? ParticipantId { get; set; }
    public Guid ActorMemberId { get; set; }
    public string Operation { get; set; } = string.Empty;
    public string Evidence { get; set; } = string.Empty;
    public string SnapshotJson { get; set; } = "{}";
    public DateTime CreatedUtc { get; set; }
    public GroupEvent Event { get; set; } = null!;
}
public sealed class EventRegistrationMaterial
{
    public Guid Id { get; set; }
    public Guid ParticipantId { get; set; }
    public Guid FileAssetId { get; set; }
    public string RequirementId { get; set; } = string.Empty;
    public Guid UploadedByMemberId { get; set; }
    public DateTime CreatedUtc { get; set; }
    public EventRegistrationParticipant Participant { get; set; } = null!;
    public FileAsset FileAsset { get; set; } = null!;
}
