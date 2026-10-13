namespace Alife.Domain.Entities;

/// <summary>
/// A project/occurrence arrangement within one Event module. The Event still owns
/// the single module report, owner and approval; changing this row changes its evidence.
/// </summary>
public sealed class EventActivityModuleConfiguration
{
    public Guid Id { get; set; }
    public Guid EventId { get; set; }
    public string ActivityId { get; set; } = "";
    public Guid? OccurrenceId { get; set; }
    public string Kind { get; set; } = "";
    public string DetailsJson { get; set; } = "{}";
    public Guid ConcurrencyToken { get; set; } = Guid.NewGuid();
    public Guid UpdatedByMemberId { get; set; }
    public DateTime UpdatedUtc { get; set; }
    public GroupEvent Event { get; set; } = null!;
    public EventOccurrence? Occurrence { get; set; }
}
