namespace Alife.Domain.Entities;

// One explicit candidate list for a role, shared by that Event's occurrences.
public sealed class EventRosterGroup
{
    public Guid Id { get; set; }
    public Guid EventId { get; set; }
    public string RoleCode { get; set; } = "";
    public string ModuleCode { get; set; } = "SERVICE.ROSTER";
    public string MemberIdsJson { get; set; } = "[]";
    public Guid ConcurrencyToken { get; set; } = Guid.NewGuid();
    public DateTime UpdatedUtc { get; set; }
}
