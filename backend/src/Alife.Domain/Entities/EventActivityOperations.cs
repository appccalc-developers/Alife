namespace Alife.Domain.Entities;

public sealed class EventActivityPolicyVersion
{
    public Guid Id { get; set; }
    public Guid EventId { get; set; }
    public string ActivityId { get; set; } = "";
    public int Version { get; set; }
    public bool IsCurrent { get; set; } = true;
    public string RulesJson { get; set; } = "{}";
    public string FeeApprovalStatus { get; set; } = "notRequired";
    public Guid? FeeSubmittedByMemberId { get; set; }
    public Guid? FeeApprovedByMemberId { get; set; }
    public Guid CreatedByMemberId { get; set; }
    public DateTime CreatedUtc { get; set; }
    public Guid ConcurrencyToken { get; set; } = Guid.NewGuid();
    public GroupEvent Event { get; set; } = null!;
}

public sealed class EventActivityOffer
{
    public Guid Id { get; set; }
    public Guid EventId { get; set; }
    public string ActivityId { get; set; } = "";
    public Guid OccurrenceId { get; set; }
    public Guid PolicyVersionId { get; set; }
    public DateTime StartUtc { get; set; }
    public DateTime EndUtc { get; set; }
    public string Status { get; set; } = "draft";
    public Guid ConcurrencyToken { get; set; } = Guid.NewGuid();
    public DateTime UpdatedUtc { get; set; }
    public GroupEvent Event { get; set; } = null!;
    public EventOccurrence Occurrence { get; set; } = null!;
    public EventActivityPolicyVersion Policy { get; set; } = null!;
}

public sealed class EventActivityParticipation
{
    public Guid Id { get; set; }
    public Guid OfferId { get; set; }
    public Guid ParticipantId { get; set; }
    public Guid PolicyVersionId { get; set; }
    public Guid FeePolicyVersionId { get; set; }
    public Guid? ChargeParticipationId { get; set; }
    public long FeeMinor { get; set; }
    public string Currency { get; set; } = "NZD";
    public string SeatStatus { get; set; } = "draft";
    public string ProcedureStatus { get; set; } = "incomplete";
    public string Eligibility { get; set; } = "needsReview";
    public bool EligibilityVerified { get; set; }
    public DateTime RequestedUtc { get; set; }
    public DateTime? QueuedUtc { get; set; }
    public DateTime? ReservedUntilUtc { get; set; }
    public Guid ConcurrencyToken { get; set; } = Guid.NewGuid();
    public EventActivityOffer Offer { get; set; } = null!;
    public EventRegistrationParticipant Participant { get; set; } = null!;
}

/// <summary>Purpose-limited identity evidence; never projected into participant lists, AI or Package JSON.</summary>
public sealed class EventParticipantPrivateData
{
    public Guid ParticipantId { get; set; }
    public DateOnly? BirthDate { get; set; }
    public Guid ProvidedByMemberId { get; set; }
    public DateTime UpdatedUtc { get; set; }
    public Guid ConcurrencyToken { get; set; } = Guid.NewGuid();
    public EventRegistrationParticipant Participant { get; set; } = null!;
}

public sealed class EventActivityConsent
{
    public Guid Id { get; set; }
    public Guid ParticipationId { get; set; }
    public Guid PolicyVersionId { get; set; }
    public Guid ActorMemberId { get; set; }
    public string Method { get; set; } = "";
    public string Evidence { get; set; } = "";
    public DateTime ConsentedUtc { get; set; }
    public EventActivityParticipation Participation { get; set; } = null!;
}

public sealed class EventActivityPayment
{
    public Guid Id { get; set; }
    public Guid ParticipationId { get; set; }
    public Guid ActorMemberId { get; set; }
    public string Operation { get; set; } = "payment";
    public long AmountMinor { get; set; }
    public string Evidence { get; set; } = "";
    public DateTime CreatedUtc { get; set; }
    public EventActivityParticipation Participation { get; set; } = null!;
}

public sealed class EventActivitySpaceRequest
{
    public Guid Id { get; set; }
    public Guid OfferId { get; set; }
    public string Kind { get; set; } = "external";
    public Guid? ReservationId { get; set; }
    public string NameEn { get; set; } = "";
    public string NameZh { get; set; } = "";
    public string Status { get; set; } = "draft";
    public string Evidence { get; set; } = "";
    public Guid RecordedByMemberId { get; set; }
    public DateTime RecordedUtc { get; set; }
    public Guid ConcurrencyToken { get; set; } = Guid.NewGuid();
    public EventActivityOffer Offer { get; set; } = null!;
    public EventVenueReservation? Reservation { get; set; }
}
