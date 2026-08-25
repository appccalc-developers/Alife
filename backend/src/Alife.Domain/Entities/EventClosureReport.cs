namespace Alife.Domain.Entities;

public class EventClosureReport
{
    public Guid EventId { get; set; }
    public string SummaryEn { get; set; } = string.Empty;
    public string SummaryZh { get; set; } = string.Empty;
    public string AttendanceNotes { get; set; } = string.Empty;
    public string FinanceNotes { get; set; } = string.Empty;
    public string IncidentNotes { get; set; } = string.Empty;
    public string FollowUpNotes { get; set; } = string.Empty;
    public string ReusableLearningsJson { get; set; } = "[]";
    public bool LeaderConfirmed { get; set; }
    public Guid? ConfirmedByMemberId { get; set; }
    public DateTime? ConfirmedUtc { get; set; }
    public DateTime CreatedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }

    public GroupEvent Event { get; set; } = null!;
    public Member? ConfirmedByMember { get; set; }
}
