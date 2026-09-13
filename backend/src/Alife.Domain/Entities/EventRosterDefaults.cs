namespace Alife.Domain.Entities;

// Immutable, Event-scoped requirements. Contains no assignments or acceptance evidence.
public sealed class EventRosterDefaults
{
    public Guid Id { get; set; }
    public Guid EventId { get; set; }
    public int Version { get; set; }
    public string RequirementsJson { get; set; } = "[]";
    public Guid CreatedByMemberId { get; set; }
    public DateTime CreatedUtc { get; set; }
    public GroupEvent Event { get; set; } = null!;
}
