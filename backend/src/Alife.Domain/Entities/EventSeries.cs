namespace Alife.Domain.Entities;

/// <summary>
/// A reusable schedule and default fact set for generating real GroupEvent instances.
/// A series never carries delivery state: registration, RAM, venue, roster and closure
/// remain attached to each generated event so one occurrence cannot silently approve another.
/// </summary>
public class EventSeries
{
    public Guid Id { get; set; }
    public Guid GroupId { get; set; }
    public Guid CreatedByMemberId { get; set; }
    public string NameEn { get; set; } = string.Empty;
    public string NameZh { get; set; } = string.Empty;
    public string DescriptionEn { get; set; } = string.Empty;
    public string DescriptionZh { get; set; } = string.Empty;
    public string TimeZoneId { get; set; } = "UTC";
    public DateOnly AnchorLocalDate { get; set; }
    public DayOfWeek Weekday { get; set; }
    public int StartTimeMinutes { get; set; }
    public int DurationMinutes { get; set; }
    public int IntervalWeeks { get; set; } = 1;
    public int GenerationHorizonWeeks { get; set; } = 8;
    public int LowHorizonWeeks { get; set; } = 4;
    public string Visibility { get; set; } = "groupVisible";
    public string DefaultModulesJson { get; set; } = "[]";
    public bool IsActive { get; set; } = true;
    public DateTime CreatedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }

    public Group Group { get; set; } = null!;
    public Member CreatedByMember { get; set; } = null!;
    public ICollection<GroupEvent> Instances { get; set; } = [];
}
