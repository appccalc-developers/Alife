namespace Alife.Application.Events.Dtos;

public sealed record RegistrationMaterialRule(string Id, LocalizedTextDto Label, string Kind, bool Required = true, int MaxCount = 1, long MaxBytes = 10485760);
public sealed record RegistrationRules(LocalizedTextDto Purpose, string Audience, Guid? EligibleGroupId, LocalizedTextDto Eligibility,
    int Capacity, DateTime OpensUtc, DateTime DeadlineUtc, bool AllowWaitlist, string Channel, LocalizedTextDto Terms,
    LocalizedTextDto PrivacyNotice, LocalizedTextDto CancellationTerms, bool ManualReview, IReadOnlyList<RegistrationMaterialRule> Materials,
    long FeeMinor = 0, string Currency = "NZD", LocalizedTextDto? PaymentInstructions = null, LocalizedTextDto? RefundTerms = null,
    string MoneyFlowScope = "unspecified");
public sealed record RegistrationPolicyDto(int Version, RegistrationRules Rules, string ETag, string FeeApprovalStatus);
public sealed record RegistrationPersonInput(Guid? MemberId, string DisplayName, bool IsChild = false, string GuardianName = "", Guid? GuardianMemberId = null);
public sealed record RegistrationApplicationRequest(Guid OrganiserMemberId, IReadOnlyList<RegistrationPersonInput> Participants,
    bool AllowSplit = false, bool IsInvitation = false, string InvitationMode = "byDeadline", DateTime? ReservationExpiresUtc = null, string Channel = "app",
    string ManualOrganiserName = "", string ProxyAuthorityEvidence = "");
public sealed record RegistrationParticipantDto(Guid Id, Guid? MemberId, string DisplayName, bool IsChild, string GuardianName,
    string SeatStatus, string ProcedureStatus, string ConsentMethod, DateTime? ConsentedUtc, bool EligibilityVerified, bool MaterialsVerified,
    string AnswersJson, long PaidMinor, long RefundedMinor, bool IsLegacy, Guid? GuardianMemberId = null, bool ProxyAccessRevoked = false);
public sealed record RegistrationApplicationDto(Guid Id, Guid OrganiserMemberId, bool AllowSplit, bool IsInvitation, string InvitationMode,
    DateTime? InvitedUtc, DateTime? ReservationExpiresUtc, string ETag, string Channel, int PolicyVersion, IReadOnlyList<RegistrationParticipantDto> Participants,
    Guid CreatedByMemberId = default, string ManualOrganiserName = "");
public sealed record RegistrationHistoryDto(Guid Id, Guid ActorMemberId, string Operation, string Evidence, DateTime CreatedUtc, Guid? ParticipantId, long? AmountMinor);
public sealed record RegistrationWorkDto(Guid EventId, LocalizedTextDto Title, RegistrationPolicyDto? Policy, bool CanConfigure,
    bool CanManage, bool CanFinance, bool CanApproveFees, bool Approved, bool PubliclyOpen, int Confirmed, int Reserved, int Waitlisted,
    IReadOnlyList<RegistrationApplicationDto> Applications, int Page, bool HasMore, Guid GroupId, DateTime EventStartUtc, DateTime EventEndUtc);
public sealed record RegistrationActionRequest(Guid? ParticipantId = null, string? Evidence = null, DateTime? OccurredUtc = null,
    string? AnswersJson = null, bool? AllowSplit = null, long? AmountMinor = null, Guid? FileAssetId = null, string? RequirementId = null);
