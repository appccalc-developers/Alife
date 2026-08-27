using Alife.Domain.Enums;

namespace Alife.Domain.Entities;

public sealed class EventSession
{
    public Guid Id { get; set; }
    public Guid OccurrenceId { get; set; }
    public string TitleEn { get; set; } = string.Empty;
    public string TitleZh { get; set; } = string.Empty;
    public DateTime StartUtc { get; set; }
    public DateTime EndUtc { get; set; }
    public string PlaceJson { get; set; } = "{}";
    public Guid? LeadMemberId { get; set; }
    public string LocalRequirementsJson { get; set; } = "[]";
    public EventSessionStatus Status { get; set; } = EventSessionStatus.Draft;
    public DateTime CreatedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }

    public EventOccurrence Occurrence { get; set; } = null!;
    public Member? LeadMember { get; set; }
    public ICollection<EventProgramItem> ProgramItems { get; set; } = [];
    public ICollection<EventServiceSlot> ServiceSlots { get; set; } = [];
}

public sealed class EventProgramItem
{
    public Guid Id { get; set; }
    public Guid SessionId { get; set; }
    public int SortOrder { get; set; }
    public int StartOffsetMinutes { get; set; }
    public int DurationMinutes { get; set; }
    public string ContentJson { get; set; } = "{}";
    public string TitleEn { get; set; } = string.Empty;
    public string TitleZh { get; set; } = string.Empty;
    public string DescriptionEn { get; set; } = string.Empty;
    public string DescriptionZh { get; set; } = string.Empty;
    public Guid? OwnerMemberId { get; set; }
    public DateTime CreatedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }

    public EventSession Session { get; set; } = null!;
    public Member? OwnerMember { get; set; }
}

public sealed class EventZone
{
    public Guid Id { get; set; }
    public Guid OccurrenceId { get; set; }
    public string TitleEn { get; set; } = string.Empty;
    public string TitleZh { get; set; } = string.Empty;
    public int? Capacity { get; set; }
    public Guid? LeadMemberId { get; set; }
    public string OperatingState { get; set; } = "planned";
    public DateTime CreatedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }

    public EventOccurrence Occurrence { get; set; } = null!;
    public Member? LeadMember { get; set; }
    public ICollection<EventServiceSlot> ServiceSlots { get; set; } = [];
}

public sealed class EventServiceSlot
{
    public Guid Id { get; set; }
    public Guid OccurrenceId { get; set; }
    public Guid? SessionId { get; set; }
    public Guid? ZoneId { get; set; }
    public Guid? ProgramItemId { get; set; }
    public string RoleCode { get; set; } = string.Empty;
    public DateTime StartUtc { get; set; }
    public DateTime EndUtc { get; set; }
    public int RequiredCount { get; set; }
    public string EligibilityCode { get; set; } = string.Empty;
    public DateTime CreatedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }

    public EventOccurrence Occurrence { get; set; } = null!;
    public EventSession? Session { get; set; }
    public EventZone? Zone { get; set; }
    public EventProgramItem? ProgramItem { get; set; }
    public ICollection<EventRosterAvailability> Availability { get; set; } = [];
    public ICollection<EventRosterAssignment> Assignments { get; set; } = [];
}
