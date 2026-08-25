namespace Alife.Domain.Entities;

public class EventOccurrence
{
    public Guid Id { get; set; }
    public Guid EventPlanId { get; set; }
    public string OccurrenceKey { get; set; } = string.Empty;
    public string NameEn { get; set; } = string.Empty;
    public string NameZh { get; set; } = string.Empty;
    public DateTime StartUtc { get; set; }
    public DateTime EndUtc { get; set; }
    public string TimeZoneId { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public EventPlan EventPlan { get; set; } = null!;
    public ICollection<EventVenueBooking> VenueBookings { get; set; } = [];
    public ICollection<EventAttendanceRecord> AttendanceRecords { get; set; } = [];
    public ICollection<EventProgrammeItem> ProgrammeItems { get; set; } = [];
}
