namespace Alife.Domain.Entities;

public class EventRosterShift
{
    public Guid Id { get; set; }
    public Guid EventId { get; set; }
    public string RoleKey { get; set; } = string.Empty;
    public string NameEn { get; set; } = string.Empty;
    public string NameZh { get; set; } = string.Empty;
    public DateTime StartUtc { get; set; }
    public DateTime EndUtc { get; set; }
    public int RequiredPeople { get; set; }
    public string RequiredLabelsJson { get; set; } = "[]";
    public string Notes { get; set; } = string.Empty;
    public DateTime CreatedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }

    public GroupEvent Event { get; set; } = null!;
    public ICollection<EventRosterAssignment> Assignments { get; set; } = [];
    public ICollection<EventProgrammeItem> ProgrammeItems { get; set; } = [];
}
