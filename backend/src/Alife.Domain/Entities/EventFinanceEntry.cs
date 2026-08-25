using Alife.Domain.Enums;

namespace Alife.Domain.Entities;

public class EventFinanceEntry
{
    public Guid Id { get; set; }
    public Guid EventId { get; set; }
    public EventFinanceEntryType Type { get; set; }
    public string Category { get; set; } = string.Empty;
    public string DescriptionEn { get; set; } = string.Empty;
    public string DescriptionZh { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public DateTime OccurredUtc { get; set; }
    public Guid RecordedByMemberId { get; set; }
    public DateTime CreatedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }

    public GroupEvent Event { get; set; } = null!;
    public Member RecordedByMember { get; set; } = null!;
}
