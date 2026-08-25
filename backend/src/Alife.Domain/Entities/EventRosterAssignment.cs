using Alife.Domain.Enums;

namespace Alife.Domain.Entities;

public class EventRosterAssignment
{
    public Guid Id { get; set; }
    public Guid ShiftId { get; set; }
    public Guid MemberId { get; set; }
    public Guid ConfirmedByMemberId { get; set; }
    public EventRosterAssignmentStatus Status { get; set; }
    public bool BasedOnSmartSuggestion { get; set; }
    public string ConfirmationNotes { get; set; } = string.Empty;
    public string MemberResponseNotes { get; set; } = string.Empty;
    public DateTime ConfirmedUtc { get; set; }
    public DateTime? RespondedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }

    public EventRosterShift Shift { get; set; } = null!;
    public Member Member { get; set; } = null!;
    public Member ConfirmedByMember { get; set; } = null!;
}
