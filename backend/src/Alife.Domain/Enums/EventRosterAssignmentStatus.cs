namespace Alife.Domain.Enums;

public enum EventRosterAssignmentStatus
{
    Confirmed = 0,
    Cancelled = 1,
    Accepted = 2,
    Declined = 3,
    ChangeRequested = 4
}

public enum EventRosterMemberResponse
{
    Accept = 0,
    Decline = 1,
    RequestChange = 2
}
