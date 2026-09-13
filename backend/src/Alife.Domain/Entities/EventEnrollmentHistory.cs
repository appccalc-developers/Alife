namespace Alife.Domain.Entities;

public sealed class EventEnrollmentHistory
{
    public Guid Id { get; set; }
    public Guid EnrollmentId { get; set; }
    public string Status { get; set; } = "confirmed";
    public string EnrollmentJson { get; set; } = "{}";
    public DateTime? QueuedUtc { get; set; }
    public DateTime? StatusChangedUtc { get; set; }
    public DateTime ArchivedUtc { get; set; }
    public EventEnrollment Enrollment { get; set; } = null!;
}
