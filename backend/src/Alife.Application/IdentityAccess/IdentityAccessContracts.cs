using System.Text.Json;
using Alife.Application.Common.Models;
using Alife.Domain.Enums;

namespace Alife.Application.IdentityAccess;

public sealed record IdentitySession(
    string Token,
    DateTime ExpiresUtc,
    bool Persistent,
    string AuthenticationMethod,
    string SessionKind,
    string ReturnPath);

public sealed record OnboardingContextDto(
    string Intent,
    bool IsPublicDevice,
    string ReturnPath,
    Guid? ActivationInvitationId = null,
    Guid? GroupJoinInviteId = null,
    Guid? GroupApplicationId = null,
    string? GroupNameEn = null,
    string? GroupNameZh = null,
    string? State = null);

public sealed record OnboardingFlowStart(string Token, OnboardingContextDto Context);

public sealed record ActiveOnboardingFlow(
    Guid Id,
    OnboardingIntent Intent,
    bool IsPublicDevice,
    Guid? ActivationInvitationId,
    Guid? ActivationMemberId,
    Guid? GroupJoinInviteId,
    string ReturnPath);

public sealed record PasskeyOptionsDto(Guid CeremonyId, JsonElement PublicKey);

public sealed record PasskeyCredentialDto(
    Guid Id,
    string DisplayName,
    DateTime CreatedUtc,
    DateTime? LastUsedUtc,
    bool IsBackedUp,
    IReadOnlyList<string> Transports);

public sealed record PasskeyCompletionDto(IdentitySession? Session, PasskeyCredentialDto? Credential);

public sealed record ActivationGrantRequest(Guid GroupId, MembershipRole Role);

public sealed record CreateActivationRequest(
    string DisplayName,
    string PhoneE164,
    ActivationPurpose Purpose,
    IReadOnlyList<ActivationGrantRequest> Grants);

public sealed record ActivationGrantDto(Guid GroupId, MembershipRole Role, StagedGrantStatus Status, string? ConflictCode);

public sealed record ActivationInvitationDto(
    Guid Id,
    Guid MemberId,
    string DisplayName,
    string MaskedPhone,
    ActivationPurpose Purpose,
    ActivationStatus Status,
    MessageDeliveryStatus DeliveryStatus,
    DateTime ExpiresUtc,
    string? PreviewUrl,
    IReadOnlyList<ActivationGrantDto> Grants);

public sealed record GroupJoinInviteDto(
    Guid Id,
    Guid GroupId,
    string Status,
    DateTime ExpiresUtc,
    DateTime? LastUsedUtc,
    int SubmissionCount,
    string? JoinUrl);

public sealed record SubmitGroupApplicationRequest(
    string DisplayName,
    string PhoneE164,
    string ReplyPreference,
    string PreferredLanguage,
    string Declaration,
    string PrivacyConsentVersion,
    bool PrivacyConsent,
    string Honeypot,
    long FormStartedUnixMilliseconds);

public sealed record ApplicationHistoryDto(
    Guid Id,
    string Kind,
    string FromStatus,
    string ToStatus,
    string? Note,
    Guid? ActorMemberId,
    DateTime CreatedUtc);

public sealed record MembershipApplicationDto(
    Guid Id,
    Guid ChurchPersonApplicationId,
    Guid GroupId,
    string GroupNameEn,
    string GroupNameZh,
    string DisplayName,
    string MaskedPhone,
    string ReplyPreference,
    string PreferredLanguage,
    string Declaration,
    bool IsContactVerified,
    string MatchState,
    string PersonStatus,
    string Status,
    string Source,
    string? ResponseDeliveryStatus,
    DateTime SubmittedUtc,
    string RowVersion,
    IReadOnlyList<ApplicationHistoryDto> History);

public sealed record MembershipApplicationPageDto(
    IReadOnlyList<MembershipApplicationDto> Items,
    int Page,
    int PageSize,
    int Total);

public sealed record DecideMembershipApplicationRequest(
    ApplicationDecisionKind Decision,
    string? Note,
    string RowVersion,
    Guid? LinkedMemberId = null,
    bool ContactVerified = false);

public sealed record AlphaAccountDto(string AccountId, string Label);

public sealed record IdentityCapabilitiesDto(
    bool PasskeysEnabled,
    bool LineLegacyEnabled,
    bool ActivationMessagingAvailable);

public interface IIdentityAccessConfiguration
{
    bool PasskeysEnabled { get; }
    bool LineLegacyEnabled { get; }
    bool ActivationMessagingAvailable { get; }
    bool ExposeActivationLinks { get; }
    bool AlphaLoginEnabled { get; }
    bool IsProduction { get; }
    string FrontendBaseUrl { get; }
    IReadOnlyList<AlphaAccountConfiguration> AlphaAccounts { get; }
}

public sealed record AlphaAccountConfiguration(string AccountId, Guid MemberId, string Label);

public interface IIdentityTokenService
{
    string CreateSecret(int byteLength = 32);
    byte[] HashToken(string value);
    byte[] HashLookup(string value);
    bool VerifyToken(string value, byte[] expectedHash);
    string SignGroupInvite(string selector, int version);
    bool VerifyGroupInvite(string selector, int version, string signature);
}

public interface IIdentityMessageSender
{
    bool IsAvailable { get; }
    Task<IdentityMessageResult> SendActivationAsync(
        string phoneE164,
        string displayName,
        string activationUrl,
        string preferredLanguage,
        CancellationToken cancellationToken);

    Task<IdentityMessageResult> SendApplicationResponseAsync(
        string phoneE164,
        string responseUrl,
        string preferredLanguage,
        CancellationToken cancellationToken);
}

public sealed record IdentityMessageResult(bool Sent, string? ErrorCode = null);

public interface IServerRateLimiter
{
    Task<RateLimitDecision> TryConsumeAsync(
        string scope,
        string rawKey,
        int limit,
        TimeSpan window,
        CancellationToken cancellationToken);
}

public sealed record RateLimitDecision(bool Allowed, DateTime RetryAfterUtc, int Remaining);

public interface IIdentitySerializableExecutor
{
    Task<T> ExecuteAsync<T>(Func<CancellationToken, Task<T>> action, CancellationToken cancellationToken);
}

public interface IPasskeyService
{
    Task<AppResult<PasskeyOptionsDto>> BeginAuthenticationAsync(Guid? onboardingFlowId, CancellationToken cancellationToken);
    Task<AppResult<PasskeyCompletionDto>> CompleteAuthenticationAsync(Guid ceremonyId, JsonElement response, CancellationToken cancellationToken);
    Task<AppResult<PasskeyOptionsDto>> BeginRegistrationAsync(Guid memberId, Guid? onboardingFlowId, CancellationToken cancellationToken);
    Task<AppResult<PasskeyCompletionDto>> CompleteRegistrationAsync(Guid ceremonyId, JsonElement response, string? displayName, CancellationToken cancellationToken);
    Task<AppResult<IReadOnlyList<PasskeyCredentialDto>>> ListAsync(Guid memberId, CancellationToken cancellationToken);
    Task<AppResult<bool>> RevokeAsync(Guid memberId, Guid credentialId, CancellationToken cancellationToken);
}

public interface IIdentityAccessService
{
    IdentityCapabilitiesDto GetCapabilities();
    Task<AppResult<OnboardingFlowStart>> CreateFlowAsync(string? returnPath, bool isPublicDevice, OnboardingIntent intent, CancellationToken cancellationToken);
    Task<AppResult<OnboardingContextDto>> ResumeFlowAsync(string token, CancellationToken cancellationToken);
    Task<AppResult<bool>> BindLineStateAsync(string flowToken, string state, CancellationToken cancellationToken);
    Task<AppResult<OnboardingContextDto>> ConsumeLineStateAsync(string flowToken, string state, CancellationToken cancellationToken);
    Task<ActiveOnboardingFlow?> GetActiveFlowAsync(string token, CancellationToken cancellationToken);
    Task<AppResult<OnboardingFlowStart>> ResolveActivationAsync(string selector, string secret, bool isPublicDevice, string? returnPath, CancellationToken cancellationToken);
    Task<AppResult<bool>> MarkActivationMismatchAsync(string flowToken, CancellationToken cancellationToken);
    Task<AppResult<IdentitySession>> CompletePublicDeviceActivationAsync(string flowToken, CancellationToken cancellationToken);
    Task<AppResult<IdentitySession>> CompletePasskeyActivationAsync(Guid flowId, CancellationToken cancellationToken);
    Task<AppResult<ActivationInvitationDto>> CreateActivationAsync(Guid actorMemberId, CreateActivationRequest request, CancellationToken cancellationToken);
    Task<AppResult<IReadOnlyList<ActivationInvitationDto>>> ListActivationsAsync(Guid actorMemberId, CancellationToken cancellationToken);
    Task<AppResult<ActivationInvitationDto>> ResendActivationAsync(Guid actorMemberId, Guid activationId, CancellationToken cancellationToken);
    Task<AppResult<bool>> RevokeActivationAsync(Guid actorMemberId, Guid activationId, CancellationToken cancellationToken);
    Task<AppResult<GroupJoinInviteDto>> GetGroupInviteAsync(Guid actorMemberId, Guid groupId, CancellationToken cancellationToken);
    Task<AppResult<GroupJoinInviteDto>> GetOrCreateGroupInviteAsync(Guid actorMemberId, Guid groupId, CancellationToken cancellationToken);
    Task<AppResult<GroupJoinInviteDto>> ChangeGroupInviteStatusAsync(Guid actorMemberId, Guid groupId, string action, CancellationToken cancellationToken);
    Task<AppResult<OnboardingFlowStart>> ResolveGroupInviteAsync(string selector, string signature, bool isPublicDevice, string? returnPath, CancellationToken cancellationToken);
    Task<AppResult<OnboardingFlowStart>> ResolveApplicationResponseAsync(string selector, string secret, CancellationToken cancellationToken);
    Task<AppResult<MembershipApplicationDto>> SubmitGroupApplicationAsync(string flowToken, Guid? applicantMemberId, SubmitGroupApplicationRequest request, CancellationToken cancellationToken);
    Task<AppResult<MembershipApplicationDto>> SupplementApplicationAsync(string flowToken, Guid? memberId, Guid? applicationId, string note, string? rowVersion, CancellationToken cancellationToken);
    Task<AppResult<MembershipApplicationPageDto>> ListGroupApplicationsAsync(Guid actorMemberId, Guid groupId, string? status, string? search, string? sort, int page, int pageSize, CancellationToken cancellationToken);
    Task<AppResult<MembershipApplicationPageDto>> ListPersonApplicationsAsync(Guid actorMemberId, string? status, string? search, string? sort, int page, int pageSize, CancellationToken cancellationToken);
    Task<AppResult<MembershipApplicationDto>> DecideGroupApplicationAsync(Guid actorMemberId, Guid groupId, Guid applicationId, DecideMembershipApplicationRequest request, CancellationToken cancellationToken);
    Task<AppResult<MembershipApplicationDto>> DecidePersonApplicationAsync(Guid actorMemberId, Guid applicationId, DecideMembershipApplicationRequest request, CancellationToken cancellationToken);
    Task<AppResult<IReadOnlyList<MembershipApplicationDto>>> ListPersonalApplicationsAsync(Guid memberId, CancellationToken cancellationToken);
    IReadOnlyList<AlphaAccountDto> ListAlphaAccounts();
    Task<AppResult<IdentitySession>> AlphaLoginAsync(string accountId, CancellationToken cancellationToken);
}
