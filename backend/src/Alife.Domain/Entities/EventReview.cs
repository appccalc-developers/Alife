namespace Alife.Domain.Entities;

public class EventReview
{
    public Guid Id { get; set; }
    public Guid GroupId { get; set; }
    public Guid EventId { get; set; }
    public Guid MemberId { get; set; }
    public string ReviewJson { get; set; } = "{}";
    public DateTime CreatedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }

    public Group Group { get; set; } = null!;
    public GroupEvent Event { get; set; } = null!;
    public Member Member { get; set; } = null!;
}
