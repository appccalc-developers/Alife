using Alife.Domain.Enums;

namespace Alife.Domain.Entities;

public sealed class EventOccurrence
{
    public Guid Id { get; set; }
    public Guid EventId { get; set; }
    public DateTime StartUtc { get; set; }
    public DateTime EndUtc { get; set; }
    public DateOnly LocalDate { get; set; }
    public EventOccurrenceStatus Status { get; set; } = EventOccurrenceStatus.Scheduled;
    public string AttendanceJson { get; set; } = "{}";
    public string ExceptionsJson { get; set; } = "[]";
    public string IncidentsJson { get; set; } = "[]";
    public bool IsLegacyBackfill { get; set; }
    public DateTime CreatedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }
    public Guid ProgrammeConcurrencyToken { get; set; } = Guid.NewGuid();
    public Guid RosterConcurrencyToken { get; set; } = Guid.NewGuid();
    public EventExecutionStatus ExecutionStatus { get; set; } = EventExecutionStatus.NotConfirmed;
    public Guid? ExecutionPackageId { get; set; }
    public Guid? ExecutionConfirmedByMemberId { get; set; }
    public DateTime? ExecutionConfirmedUtc { get; set; }
    public EventPackageEnforcementMode ExecutionGateMode { get; set; } = EventPackageEnforcementMode.Off;
    public Guid ExecutionConcurrencyToken { get; set; } = Guid.NewGuid();

    public GroupEvent Event { get; set; } = null!;
    public EventPackage? ExecutionPackage { get; set; }
    public Member? ExecutionConfirmedByMember { get; set; }
    public ICollection<EventSession> Sessions { get; set; } = [];
    public ICollection<EventZone> Zones { get; set; } = [];
    public ICollection<EventServiceSlot> ServiceSlots { get; set; } = [];
    public ICollection<EventVenueReservation> VenueReservations { get; set; } = [];
    public ICollection<EventTravelJourney> TravelJourneys { get; set; } = [];
    public ICollection<EventChildAttendance> ChildAttendanceRecords { get; set; } = [];
}
