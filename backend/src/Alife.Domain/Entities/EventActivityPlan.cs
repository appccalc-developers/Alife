namespace Alife.Domain.Entities;

public sealed class EventActivityPlan
{
    public Guid EventId { get; set; }
    public string DataJson { get; set; } = "{}";
    public Guid ConcurrencyToken { get; set; } = Guid.NewGuid();
    public DateTime UpdatedUtc { get; set; }
    public GroupEvent Event { get; set; } = null!;
}
