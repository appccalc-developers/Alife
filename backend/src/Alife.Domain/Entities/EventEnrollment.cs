namespace Alife.Domain.Entities;

public class EventEnrollment
{
    public Guid Id { get; set; }
    public Guid GroupId { get; set; }
    public Guid EventId { get; set; }
    public Guid MemberId { get; set; }
    public string EnrollmentJson { get; set; } = "{}";
    public DateTime CreatedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }

    public Group Group { get; set; } = null!;
    public GroupEvent Event { get; set; } = null!;
    public Member Member { get; set; } = null!;
}
