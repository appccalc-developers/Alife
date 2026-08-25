namespace Alife.Domain.Entities;

public class EventFinanceReconciliation
{
    public Guid EventId { get; set; }
    public string NotesEn { get; set; } = string.Empty;
    public string NotesZh { get; set; } = string.Empty;
    public bool LeaderConfirmed { get; set; }
    public Guid? ConfirmedByMemberId { get; set; }
    public DateTime? ConfirmedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }

    public GroupEvent Event { get; set; } = null!;
    public Member? ConfirmedByMember { get; set; }
}
