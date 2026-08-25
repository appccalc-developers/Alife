namespace Alife.Domain.Entities;

public class VenueSpace
{
    public Guid Id { get; set; }
    public Guid VenueId { get; set; }
    public string NameEn { get; set; } = string.Empty;
    public string NameZh { get; set; } = string.Empty;
    public int Capacity { get; set; }
    public string ResourcesJson { get; set; } = "[]";
    public string BookingPolicyJson { get; set; } = "{}";
    public bool IsActive { get; set; }
    public DateTime CreatedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }

    public Venue Venue { get; set; } = null!;
    public ICollection<EventVenueBooking> Bookings { get; set; } = [];
}
