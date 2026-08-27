namespace Alife.Domain.Enums;

public enum EventGovernanceMode
{
    Private = 0,
    MemberLed = 1,
    ChurchSponsored = 2
}

public enum EventSponsorshipStatus
{
    NotRequested = 0,
    Pending = 1,
    Approved = 2,
    Rejected = 3,
    Revoked = 4
}

public enum EventOccurrenceStatus
{
    Scheduled = 0,
    Cancelled = 1,
    Completed = 2
}

public enum EventFactCertainty
{
    Unknown = 0,
    Candidate = 1,
    Confirmed = 2
}

public enum EventFactSource
{
    Human = 0,
    TrustedContext = 1,
    AiCandidate = 2,
    LegacyBackfill = 3
}

public enum EventModuleDecisionStatus
{
    Required = 0,
    Recommended = 1,
    Selected = 2,
    Inactive = 3,
    ExceptionRequested = 4,
    ExceptionApproved = 5
}

public enum EventReadinessStatus
{
    NotReady = 0,
    Blocked = 1,
    Ready = 2,
    Complete = 3
}

public enum EventApprovalDecisionType
{
    Submitted = 0,
    Approved = 1,
    Rejected = 2,
    Revoked = 3
}

public enum EventTeamMemberStatus { Invited = 0, Accepted = 1, Declined = 2, Ended = 3 }
public enum EventRoleAssignmentStatus { Invited = 0, Accepted = 1, Declined = 2, Ended = 3 }
public enum EventTaskStatus { Todo = 0, InProgress = 1, Blocked = 2, Done = 3, Cancelled = 4 }
public enum EventSessionStatus { Draft = 0, Confirmed = 1, Cancelled = 2 }
public enum EventAvailabilityStatus { Unknown = 0, Available = 1, Unavailable = 2, PreferNot = 3 }
public enum EventRosterAssignmentStatus { Invited = 0, Confirmed = 1, Declined = 2, Ended = 3 }
public enum EventVenueReservationStatus { Confirmed = 0, Released = 1 }
public enum EventTravelJourneyStatus { Planned = 0, Confirmed = 1, Cancelled = 2 }
public enum EventGuardianRelationshipStatus { Pending = 0, Confirmed = 1, Ended = 2 }
public enum EventGuardianConsentDecision { Granted = 0, Withdrawn = 1 }
public enum EventChildAttendanceState { Present = 0, CheckedOut = 1 }
