namespace Alife.Domain.Entities;

public sealed class EventVenueWeeklyBooking
{
    public Guid Id { get; set; }
    public Guid VenueId { get; set; }
    public Guid EventId { get; set; }
    public DateOnly FirstDate { get; set; }
    public DateOnly? LastDate { get; set; }
    public int StartMinute { get; set; }
    public int EndMinute { get; set; }
    public string TimeZone { get; set; } = "Pacific/Auckland";
    public int RequiredCapacity { get; set; }
    public Guid? ReplacesRuleId { get; set; }
    public DateOnly? PreviousLastDate { get; set; }
    public string ChangeReason { get; set; } = string.Empty;
    public Guid CreatedByMemberId { get; set; }
    public DateTime CreatedUtc { get; set; }
    public Guid ConcurrencyToken { get; set; } = Guid.NewGuid();
    public EventVenue Venue { get; set; } = null!;
    public GroupEvent Event { get; set; } = null!;
    public ICollection<EventVenueBookingException> Exceptions { get; set; } = [];
}
public sealed class EventVenueBookingException
{
    public Guid Id { get; set; }
    public Guid WeeklyBookingId { get; set; }
    public DateOnly LocalDate { get; set; }
    public bool Released { get; set; }
    public string Reason { get; set; } = string.Empty;
    public Guid ActorMemberId { get; set; }
    public DateTime CreatedUtc { get; set; }
    public EventVenueWeeklyBooking WeeklyBooking { get; set; } = null!;
}
