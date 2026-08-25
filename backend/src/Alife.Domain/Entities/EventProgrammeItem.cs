using Alife.Domain.Enums;

namespace Alife.Domain.Entities;

public class EventProgrammeItem
{
    public Guid Id { get; set; }
    public Guid EventId { get; set; }
    public Guid? EventOccurrenceId { get; set; }
    public Guid? RosterShiftId { get; set; }
    public Guid? OwnerMemberId { get; set; }
    public int SortOrder { get; set; }
    public DateTime StartUtc { get; set; }
    public DateTime EndUtc { get; set; }
    public string TitleEn { get; set; } = string.Empty;
    public string TitleZh { get; set; } = string.Empty;
    public string InstructionsEn { get; set; } = string.Empty;
    public string InstructionsZh { get; set; } = string.Empty;
    public bool RequiresHandover { get; set; }
    public string HandoverEn { get; set; } = string.Empty;
    public string HandoverZh { get; set; } = string.Empty;
    public EventProgrammeItemStatus Status { get; set; }
    public Guid UpdatedByMemberId { get; set; }
    public DateTime CreatedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }

    public GroupEvent Event { get; set; } = null!;
    public EventOccurrence? EventOccurrence { get; set; }
    public EventRosterShift? RosterShift { get; set; }
    public Member? OwnerMember { get; set; }
    public Member UpdatedByMember { get; set; } = null!;
}
