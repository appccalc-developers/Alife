namespace Alife.Domain.Entities;

/// <summary>
/// A protected, leader-maintained attendance result for one event session.
/// An enrollment-backed row records the attended units for that registration;
/// a row without an enrollment is the aggregate walk-in count for the session.
/// </summary>
public class EventAttendanceRecord
{
    public Guid Id { get; set; }
    public Guid EventId { get; set; }
    public Guid EventOccurrenceId { get; set; }
    public Guid? EventEnrollmentId { get; set; }
    public int AttendedUnits { get; set; }
    public string Notes { get; set; } = string.Empty;
    public Guid RecordedByMemberId { get; set; }
    public DateTime CreatedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }

    public GroupEvent Event { get; set; } = null!;
    public EventOccurrence EventOccurrence { get; set; } = null!;
    public EventEnrollment? EventEnrollment { get; set; }
    public Member RecordedByMember { get; set; } = null!;
}
