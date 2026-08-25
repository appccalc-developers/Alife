using Alife.Domain.Enums;

namespace Alife.Domain.Entities;

public class EventVenueBooking
{
    public Guid Id { get; set; }
    public Guid EventId { get; set; }
    public Guid? EventOccurrenceId { get; set; }
    public Guid VenueSpaceId { get; set; }
    public Guid RequestedByMemberId { get; set; }
    public Guid? SubmittedByMemberId { get; set; }
    public Guid? ReviewedByMemberId { get; set; }
    public string PurposeEn { get; set; } = string.Empty;
    public string PurposeZh { get; set; } = string.Empty;
    public string Notes { get; set; } = string.Empty;
    public string DecisionNotes { get; set; } = string.Empty;
    public DateTime StartUtc { get; set; }
    public DateTime EndUtc { get; set; }
    public int AttendeeCount { get; set; }
    public VenueBookingStatus Status { get; set; }
    public DateTime? SubmittedUtc { get; set; }
    public DateTime? ReviewedUtc { get; set; }
    public DateTime CreatedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }
    public byte[] RowVersion { get; set; } = [];

    public GroupEvent Event { get; set; } = null!;
    public EventOccurrence? EventOccurrence { get; set; }
    public VenueSpace VenueSpace { get; set; } = null!;
    public Member RequestedByMember { get; set; } = null!;
    public Member? SubmittedByMember { get; set; }
    public Member? ReviewedByMember { get; set; }
}
