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

public enum EventPackageScopeType { Event = 0, Occurrence = 1 }
public enum EventPackageCoverageMode { ExplicitOccurrences = 0, PlanBoundSeriesWindow = 1 }
public enum EventGovernanceTier { Light = 0, Standard = 1, Enhanced = 2 }
public enum EventPackageStatus
{
    Draft = 0,
    Submitted = 1,
    ReturnedForAmendment = 2,
    Rejected = 3,
    ApprovedWithConditions = 4,
    Approved = 5,
    Withdrawn = 6,
    Superseded = 7
}
public enum EventPackageApprovalValidity { NotDecided = 0, Active = 1, Invalidated = 2, Expired = 3, Revoked = 4 }
public enum EventPackageEnforcementMode { Off = 0, DryRun = 1, Enforced = 2 }
public enum LegacyEventPackageTransition
{
    FormalPackageRequired = 0,
    LegacyReadOnlyPackage = 1,
    TimeLimitedCompatibility = 2,
    SafetyCriticalBlocked = 3
}
public enum EventPackageDecisionType { Approve = 0, ApproveWithConditions = 1, ReturnForAmendment = 2, Reject = 3, Revoke = 4, ConditionWaiver = 5 }
public enum EventPackageConditionStatus { Open = 0, EvidenceSubmitted = 1, Verified = 2, Rejected = 3, Expired = 4, Waived = 5 }
public enum EventLifecycleGate { Publish = 0, Registration = 1, Payment = 2, Execute = 3 }
public enum EventPublicationStatus { LegacyImplicit = 0, Draft = 1, Published = 2, Unpublished = 3 }
public enum EventRegistrationStatus { LegacyImplicit = 0, Closed = 1, Open = 2 }
public enum EventExecutionStatus { NotConfirmed = 0, Confirmed = 1, Invalidated = 2 }
public enum EventPackageDelegationScopeType { Organisation = 0, Event = 1, Occurrence = 2 }
