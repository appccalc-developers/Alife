using Alife.Domain.Enums;

namespace Alife.Domain.Entities;

/// <summary>A reusable venue managed by a group. Event/session display text is not authoritative venue data.</summary>
public sealed class EventVenue
{
    public Guid Id { get; set; }
    public Guid ManagingGroupId { get; set; }
    public string NameEn { get; set; } = string.Empty;
    public string NameZh { get; set; } = string.Empty;
    public string AddressEn { get; set; } = string.Empty;
    public string AddressZh { get; set; } = string.Empty;
    public int Capacity { get; set; }
    public bool IsActive { get; set; } = true;
    public Guid ConcurrencyToken { get; set; } = Guid.NewGuid();
    public Guid CreatedByMemberId { get; set; }
    public DateTime CreatedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }

    public Group ManagingGroup { get; set; } = null!;
    public Member CreatedByMember { get; set; } = null!;
    public ICollection<EventVenueReservation> Reservations { get; set; } = [];
}

/// <summary>
/// An auditable venue booking. EventId is always present for ownership and authorisation;
/// EventOccurrenceId narrows the booking to one occurrence when supplied.
/// </summary>
public sealed class EventVenueReservation
{
    public Guid Id { get; set; }
    public Guid VenueId { get; set; }
    public Guid EventId { get; set; }
    public Guid? EventOccurrenceId { get; set; }
    public DateTime StartUtc { get; set; }
    public DateTime EndUtc { get; set; }
    public int RequiredCapacity { get; set; }
    public EventVenueReservationStatus Status { get; set; } = EventVenueReservationStatus.Confirmed;
    public Guid ReservedByMemberId { get; set; }
    public Guid? ReleasedByMemberId { get; set; }
    public DateTime? ReleasedUtc { get; set; }
    public Guid ConcurrencyToken { get; set; } = Guid.NewGuid();
    public DateTime CreatedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }

    public EventVenue Venue { get; set; } = null!;
    public GroupEvent Event { get; set; } = null!;
    public EventOccurrence? EventOccurrence { get; set; }
    public Member ReservedByMember { get; set; } = null!;
    public Member? ReleasedByMember { get; set; }
}
