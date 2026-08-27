using Alife.Domain.Enums;

namespace Alife.Domain.Entities;

/// <summary>Event-scoped driver evidence. Raw licence document content is deliberately not stored.</summary>
public sealed class EventTravelDriver
{
    public Guid Id { get; set; }
    public Guid EventId { get; set; }
    public Guid MemberId { get; set; }
    public string LicenceClass { get; set; } = string.Empty;
    public DateOnly? LicenceExpiresOn { get; set; }
    public bool LicenceConfirmed { get; set; }
    public bool FitToDriveConfirmed { get; set; }
    public string EvidenceNotes { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public Guid VerifiedByMemberId { get; set; }
    public DateTime VerifiedUtc { get; set; }
    public Guid ConcurrencyToken { get; set; } = Guid.NewGuid();
    public DateTime CreatedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }

    public GroupEvent Event { get; set; } = null!;
    public Member Member { get; set; } = null!;
    public Member VerifiedByMember { get; set; } = null!;
    public ICollection<EventTravelJourney> Journeys { get; set; } = [];
}

/// <summary>Event-scoped vehicle evidence. It is not a public event projection.</summary>
public sealed class EventTravelVehicle
{
    public Guid Id { get; set; }
    public Guid EventId { get; set; }
    public string NameEn { get; set; } = string.Empty;
    public string NameZh { get; set; } = string.Empty;
    public string RegistrationReference { get; set; } = string.Empty;
    public int SeatCapacity { get; set; }
    public bool RegistrationConfirmed { get; set; }
    public DateOnly? RegistrationExpiresOn { get; set; }
    public bool WofConfirmed { get; set; }
    public DateOnly? WofExpiresOn { get; set; }
    public string EvidenceNotes { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public Guid VerifiedByMemberId { get; set; }
    public DateTime VerifiedUtc { get; set; }
    public Guid ConcurrencyToken { get; set; } = Guid.NewGuid();
    public DateTime CreatedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }

    public GroupEvent Event { get; set; } = null!;
    public Member VerifiedByMember { get; set; } = null!;
    public ICollection<EventTravelJourney> Journeys { get; set; } = [];
}

public sealed class EventTravelJourney
{
    public Guid Id { get; set; }
    public Guid EventId { get; set; }
    public Guid EventOccurrenceId { get; set; }
    public string NameEn { get; set; } = string.Empty;
    public string NameZh { get; set; } = string.Empty;
    public DateTime StartUtc { get; set; }
    public DateTime EndUtc { get; set; }
    public Guid? DriverId { get; set; }
    public Guid? VehicleId { get; set; }
    public bool ManifestConfirmed { get; set; }
    public EventTravelJourneyStatus Status { get; set; } = EventTravelJourneyStatus.Planned;
    public Guid CreatedByMemberId { get; set; }
    public Guid ConcurrencyToken { get; set; } = Guid.NewGuid();
    public DateTime CreatedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }

    public GroupEvent Event { get; set; } = null!;
    public EventOccurrence EventOccurrence { get; set; } = null!;
    public EventTravelDriver? Driver { get; set; }
    public EventTravelVehicle? Vehicle { get; set; }
    public Member CreatedByMember { get; set; } = null!;
    public ICollection<EventTravelPickupStop> PickupStops { get; set; } = [];
    public ICollection<EventTravelPassengerAssignment> PassengerAssignments { get; set; } = [];
}

public sealed class EventTravelPickupStop
{
    public Guid Id { get; set; }
    public Guid JourneyId { get; set; }
    public int SortOrder { get; set; }
    public string NameEn { get; set; } = string.Empty;
    public string NameZh { get; set; } = string.Empty;
    public string AddressEn { get; set; } = string.Empty;
    public string AddressZh { get; set; } = string.Empty;
    public DateTime PickupUtc { get; set; }
    public DateTime CreatedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }

    public EventTravelJourney Journey { get; set; } = null!;
    public ICollection<EventTravelPassengerAssignment> PassengerAssignments { get; set; } = [];
}

/// <summary>Role-restricted manifest row. Ended rows are retained for operational audit.</summary>
public sealed class EventTravelPassengerAssignment
{
    public Guid Id { get; set; }
    public Guid JourneyId { get; set; }
    public Guid MemberId { get; set; }
    public Guid PickupStopId { get; set; }
    public Guid AssignedByMemberId { get; set; }
    public DateTime AssignedUtc { get; set; }
    public Guid? EndedByMemberId { get; set; }
    public DateTime? EndedUtc { get; set; }

    public EventTravelJourney Journey { get; set; } = null!;
    public Member Member { get; set; } = null!;
    public EventTravelPickupStop PickupStop { get; set; } = null!;
    public Member AssignedByMember { get; set; } = null!;
    public Member? EndedByMember { get; set; }
}
