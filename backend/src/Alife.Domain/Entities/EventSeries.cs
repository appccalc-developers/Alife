namespace Alife.Domain.Entities;

public sealed class EventSeries
{
    public Guid Id { get; set; }
    public Guid OwningGroupId { get; set; }
    public Guid CreatedByMemberId { get; set; }
    public string NameEn { get; set; } = string.Empty;
    public string NameZh { get; set; } = string.Empty;
    public string RecurrenceRule { get; set; } = string.Empty;
    public string TimeZone { get; set; } = "UTC";
    public string ExceptionDatesJson { get; set; } = "[]";
    public string DefaultFactsJson { get; set; } = "{}";
    public string DefaultTeamJson { get; set; } = "[]";
    public int RollingOccurrenceWeeks { get; set; } = 12;
    public DateTime CreatedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }
    public bool IsDeleted { get; set; }

    public Group OwningGroup { get; set; } = null!;
    public Member CreatedByMember { get; set; } = null!;
    public ICollection<GroupEvent> Events { get; set; } = [];
}
