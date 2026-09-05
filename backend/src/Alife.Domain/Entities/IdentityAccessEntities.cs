using Alife.Domain.Enums;

namespace Alife.Domain.Entities;

public sealed class PasskeyCeremony
{
    public Guid Id { get; set; }
    public PasskeyCeremonyKind Kind { get; set; }
    public Guid? MemberId { get; set; }
    public Guid? OnboardingFlowId { get; set; }
    public string OptionsJson { get; set; } = string.Empty;
    public DateTime CreatedUtc { get; set; }
    public DateTime ExpiresUtc { get; set; }
    public DateTime? ConsumedUtc { get; set; }

    public Member? Member { get; set; }
    public OnboardingFlow? OnboardingFlow { get; set; }
}

public sealed class OnboardingFlow
{
    public Guid Id { get; set; }
    public byte[] TokenHash { get; set; } = [];
    public OnboardingIntent Intent { get; set; }
    public string? ReturnPath { get; set; }
    public bool IsPublicDevice { get; set; }
    public Guid? ActivationInvitationId { get; set; }
    public Guid? GroupJoinInviteId { get; set; }
    public Guid? ApplicationResponseTokenId { get; set; }
    public byte[]? LineOAuthStateHash { get; set; }
    public DateTime CreatedUtc { get; set; }
    public DateTime ExpiresUtc { get; set; }
    public DateTime? ConsumedUtc { get; set; }
}

public sealed class MemberActivationInvitation
{
    public Guid? RecoveryGroupId { get; set; }
    public Guid? SourceApplicationId { get; set; }
    public Guid Id { get; set; }
    public Guid MemberId { get; set; }
    public Guid IssuedByMemberId { get; set; }
    public string Selector { get; set; } = string.Empty;
    public byte[] SecretHash { get; set; } = [];
    public ActivationPurpose Purpose { get; set; }
    public ActivationStatus Status { get; set; }
    public MessageDeliveryStatus DeliveryStatus { get; set; }
    public string? DeliveryErrorCode { get; set; }
    public DateTime CreatedUtc { get; set; }
    public DateTime ExpiresUtc { get; set; }
    public DateTime? SentUtc { get; set; }
    public DateTime? UsedUtc { get; set; }
    public DateTime? RevokedUtc { get; set; }

    public Member Member { get; set; } = null!;
    public Member IssuedByMember { get; set; } = null!;
    public ICollection<ActivationGroupGrant> Grants { get; set; } = [];
}

public sealed class ActivationGroupGrant
{
    public Guid Id { get; set; }
    public Guid ActivationInvitationId { get; set; }
    public Guid GroupId { get; set; }
    public MembershipRole Role { get; set; }
    public StagedGrantStatus Status { get; set; }
    public string? ConflictCode { get; set; }
    public DateTime CreatedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }

    public MemberActivationInvitation ActivationInvitation { get; set; } = null!;
    public Group Group { get; set; } = null!;
}

public sealed class GroupJoinInvite
{
    public Guid Id { get; set; }
    public Guid GroupId { get; set; }
    public Guid CreatedByMemberId { get; set; }
    public string Selector { get; set; } = string.Empty;
    public int Version { get; set; }
    public GroupJoinInviteStatus Status { get; set; }
    public DateTime CreatedUtc { get; set; }
    public DateTime ExpiresUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }
    public DateTime? LastUsedUtc { get; set; }
    public int SubmissionCount { get; set; }

    public Group Group { get; set; } = null!;
    public Member CreatedByMember { get; set; } = null!;
}

public sealed class ChurchPersonApplication
{
    public Guid Id { get; set; }
    public Guid? ApplicantMemberId { get; set; }
    public Guid? LinkedMemberId { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public string? PhoneE164 { get; set; }
    public byte[]? PhoneLookupHash { get; set; }
    public string ReplyPreference { get; set; } = string.Empty;
    public string PreferredLanguage { get; set; } = string.Empty;
    public string Declaration { get; set; } = string.Empty;
    public string PrivacyConsentVersion { get; set; } = string.Empty;
    public DateTime PrivacyConsentedUtc { get; set; }
    public bool IsContactVerified { get; set; }
    public bool IsIdentityVerified { get; set; }
    public Guid? IdentityVerifiedByMemberId { get; set; }
    public DateTime? IdentityVerifiedUtc { get; set; }
    public ApplicantMatchState MatchState { get; set; }
    public MembershipApplicationStatus Status { get; set; }
    public DateTime SubmittedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }
    public byte[] RowVersion { get; set; } = [];

    public Member? ApplicantMember { get; set; }
    public Member? LinkedMember { get; set; }
    public ICollection<GroupMembershipApplication> GroupApplications { get; set; } = [];
}

public sealed class GroupMembershipApplication
{
    public byte[]? BrowserTokenHash { get; set; }
    public DateTime? BrowserTokenExpiresUtc { get; set; }
    public DateTime? BrowserTokenConsumedUtc { get; set; }
    public Guid Id { get; set; }
    public Guid ChurchPersonApplicationId { get; set; }
    public Guid GroupId { get; set; }
    public Guid GroupJoinInviteId { get; set; }
    public Guid? ApplicantMemberId { get; set; }
    public byte[] DeduplicationKey { get; set; } = [];
    public MembershipApplicationStatus Status { get; set; }
    public string Source { get; set; } = string.Empty;
    public DateTime SubmittedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }
    public byte[] RowVersion { get; set; } = [];

    public ChurchPersonApplication ChurchPersonApplication { get; set; } = null!;
    public Group Group { get; set; } = null!;
    public GroupJoinInvite GroupJoinInvite { get; set; } = null!;
    public Member? ApplicantMember { get; set; }
    public ICollection<ApplicationHistory> History { get; set; } = [];
}

public sealed class ApplicationHistory
{
    public Guid Id { get; set; }
    public Guid GroupMembershipApplicationId { get; set; }
    public Guid? ActorMemberId { get; set; }
    public ApplicationDecisionKind Kind { get; set; }
    public MembershipApplicationStatus FromStatus { get; set; }
    public MembershipApplicationStatus ToStatus { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedUtc { get; set; }

    public GroupMembershipApplication GroupMembershipApplication { get; set; } = null!;
    public Member? ActorMember { get; set; }
}

public sealed class ApplicationResponseToken
{
    public Guid Id { get; set; }
    public Guid GroupMembershipApplicationId { get; set; }
    public string Selector { get; set; } = string.Empty;
    public byte[] SecretHash { get; set; } = [];
    public MessageDeliveryStatus DeliveryStatus { get; set; }
    public DateTime CreatedUtc { get; set; }
    public DateTime ExpiresUtc { get; set; }
    public DateTime? ConsumedUtc { get; set; }
    public DateTime? RevokedUtc { get; set; }

    public GroupMembershipApplication GroupMembershipApplication { get; set; } = null!;
}

public sealed class RateLimitBucket
{
    public Guid Id { get; set; }
    public string Scope { get; set; } = string.Empty;
    public byte[] KeyHash { get; set; } = [];
    public DateTime WindowStartedUtc { get; set; }
    public DateTime ExpiresUtc { get; set; }
    public int Count { get; set; }
}
