namespace Alife.Domain.Entities;

public class GroupMemberSchedulingProfile
{
    public Guid GroupId { get; set; }
    public Guid MemberId { get; set; }
    public string PreferredRoleKeysJson { get; set; } = "[]";
    public string UnavailableWindowsJson { get; set; } = "[]";
    public int MaxAssignmentsPerDay { get; set; } = 1;
    public string SelfNotes { get; set; } = string.Empty;
    public string ManagerLabelsJson { get; set; } = "[]";
    public string ManagerNotes { get; set; } = string.Empty;
    public DateTime? MemberUpdatedUtc { get; set; }
    public DateTime? ManagerUpdatedUtc { get; set; }

    public Group Group { get; set; } = null!;
    public Member Member { get; set; } = null!;
}
