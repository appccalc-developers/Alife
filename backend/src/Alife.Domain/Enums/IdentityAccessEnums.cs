namespace Alife.Domain.Enums;

public enum PasskeyCeremonyKind
{
    Registration = 0,
    Authentication = 1
}

public enum OnboardingIntent
{
    SignIn = 0,
    Activation = 1,
    GroupJoin = 2,
    AccessRecovery = 3,
    ApplicationResponse = 4,
    LineLegacy = 5
}

public enum ActivationPurpose
{
    FirstActivation = 0,
    PasskeyRecovery = 1
}

public enum ActivationStatus
{
    PendingDelivery = 0,
    Active = 1,
    Used = 2,
    Revoked = 3,
    IdentityMismatch = 4,
    Expired = 5
}

public enum MessageDeliveryStatus
{
    Pending = 0,
    Sent = 1,
    Unavailable = 2,
    Failed = 3
}

public enum StagedGrantStatus
{
    Pending = 0,
    Applied = 1,
    Conflict = 2,
    Revoked = 3
}

public enum GroupJoinInviteStatus
{
    Active = 0,
    Paused = 1,
    Revoked = 2,
    Rotated = 3,
    Expired = 4
}

public enum MembershipApplicationStatus
{
    Submitted = 0,
    NeedsInfo = 1,
    ApprovedWaitingForChurch = 2,
    Approved = 3,
    Rejected = 4
}

public enum ApplicantMatchState
{
    None = 0,
    Possible = 1,
    Ambiguous = 2,
    Linked = 3
}

public enum ApplicationDecisionKind
{
    Submitted = 0,
    Approved = 1,
    NeedsInfo = 2,
    Rejected = 3,
    Supplemented = 4,
    LinkedToMember = 5,
    MembershipApplied = 6,
    MembershipConflict = 7
}
