using Alife.Domain.Enums;

namespace Alife.Domain.Entities;

public sealed class EventRoleAssignment
{
    public Guid Id { get; set; }
    public Guid EventId { get; set; }
    public string RoleRequirementKey { get; set; } = string.Empty;
    public Guid MemberId { get; set; }
    public string ScopeType { get; set; } = "event";
    public Guid? ScopeId { get; set; }
    public Guid AssignedByMemberId { get; set; }
    public EventRoleAssignmentStatus Status { get; set; } = EventRoleAssignmentStatus.Invited;
    public DateTime? AcceptedUtc { get; set; }
    public DateTime? DeclinedUtc { get; set; }
    public DateTime? EndedUtc { get; set; }
    public DateTime CreatedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }

    public GroupEvent Event { get; set; } = null!;
    public Member Member { get; set; } = null!;
    public Member AssignedByMember { get; set; } = null!;
}

public sealed class EventTeamMember
{
    public Guid Id { get; set; }
    public Guid EventId { get; set; }
    public Guid MemberId { get; set; }
    public Guid InvitedByMemberId { get; set; }
    public EventTeamMemberStatus Status { get; set; } = EventTeamMemberStatus.Invited;
    public DateTime? JoinedUtc { get; set; }
    public DateTime? DeclinedUtc { get; set; }
    public DateTime? EndedUtc { get; set; }
    public DateTime CreatedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }

    public GroupEvent Event { get; set; } = null!;
    public Member Member { get; set; } = null!;
    public Member InvitedByMember { get; set; } = null!;
}

public sealed class EventApprovalDecision
{
    public Guid Id { get; set; }
    public Guid EventId { get; set; }
    public string SubjectType { get; set; } = string.Empty;
    public int SubjectVersion { get; set; }
    public EventApprovalDecisionType Decision { get; set; }
    public Guid ActorMemberId { get; set; }
    public string Reason { get; set; } = string.Empty;
    public DateTime DecidedUtc { get; set; }

    public GroupEvent Event { get; set; } = null!;
    public Member ActorMember { get; set; } = null!;
}
