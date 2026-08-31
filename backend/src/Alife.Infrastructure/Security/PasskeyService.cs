using System.Text.Json;
using Alife.Application.Abstractions.Security;
using Alife.Application.Common.Models;
using Alife.Application.IdentityAccess;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Fido2NetLib;
using Fido2NetLib.Objects;
using Microsoft.EntityFrameworkCore;

namespace Alife.Infrastructure.Security;

public sealed class PasskeyService(
    IFido2 fido2,
    AlifeDbContext dbContext,
    IIdentityAccessConfiguration configuration,
    IJwtTokenService jwtTokenService,
    IIdentityAccessService identityAccessService,
    IIdentitySerializableExecutor serializableExecutor) : IPasskeyService
{
    public async Task<AppResult<PasskeyOptionsDto>> BeginAuthenticationAsync(
        Guid? onboardingFlowId,
        CancellationToken cancellationToken)
    {
        if (!configuration.PasskeysEnabled)
        {
            return AppResult<PasskeyOptionsDto>.NotFound("passkeys_disabled");
        }

        var options = fido2.GetAssertionOptions(new GetAssertionOptionsParams
        {
            AllowedCredentials = [],
            UserVerification = UserVerificationRequirement.Required,
            Extensions = new AuthenticationExtensionsClientInputs { Extensions = true }
        });
        var ceremony = new PasskeyCeremony
        {
            Id = Guid.NewGuid(),
            Kind = PasskeyCeremonyKind.Authentication,
            OnboardingFlowId = onboardingFlowId,
            OptionsJson = options.ToJson(),
            CreatedUtc = DateTime.UtcNow,
            ExpiresUtc = DateTime.UtcNow.AddMinutes(5)
        };
        dbContext.PasskeyCeremonies.Add(ceremony);
        await dbContext.SaveChangesAsync(cancellationToken);
        return AppResult<PasskeyOptionsDto>.Success(new PasskeyOptionsDto(
            ceremony.Id,
            JsonDocument.Parse(ceremony.OptionsJson).RootElement.Clone()));
    }

    public async Task<AppResult<PasskeyCompletionDto>> CompleteAuthenticationAsync(
        Guid ceremonyId,
        JsonElement response,
        CancellationToken cancellationToken)
        => await serializableExecutor.ExecuteAsync(
            token => CompleteAuthenticationCoreAsync(ceremonyId, response, token),
            cancellationToken);

    private async Task<AppResult<PasskeyCompletionDto>> CompleteAuthenticationCoreAsync(
        Guid ceremonyId,
        JsonElement response,
        CancellationToken cancellationToken)
    {
        var ceremony = await dbContext.PasskeyCeremonies
            .Include(item => item.OnboardingFlow)
            .SingleOrDefaultAsync(item => item.Id == ceremonyId, cancellationToken);
        if (!IsActive(ceremony, PasskeyCeremonyKind.Authentication))
        {
            return AppResult<PasskeyCompletionDto>.Conflict("passkey_challenge_invalid");
        }

        ceremony!.ConsumedUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        try
        {
            var raw = JsonSerializer.Deserialize<AuthenticatorAssertionRawResponse>(response.GetRawText())
                      ?? throw new InvalidOperationException("Assertion response is missing.");
            var credential = await dbContext.MemberPasskeyCredentials
                .Include(item => item.Member)
                    .ThenInclude(member => member.PlatformRoles)
                        .ThenInclude(role => role.Role)
                .SingleOrDefaultAsync(item => item.CredentialId == raw.RawId && item.RevokedUtc == null, cancellationToken);
            if (credential is null || !credential.Member.IsRegistered)
            {
                return AppResult<PasskeyCompletionDto>.Forbidden("passkey_unknown");
            }

            var originalOptions = AssertionOptions.FromJson(ceremony.OptionsJson);
            var verified = await fido2.MakeAssertionAsync(new MakeAssertionParams
            {
                AssertionResponse = raw,
                OriginalOptions = originalOptions,
                StoredPublicKey = credential.PublicKey,
                StoredSignatureCounter = credential.SignatureCounter,
                IsUserHandleOwnerOfCredentialIdCallback = async (args, token) =>
                    await dbContext.MemberPasskeyCredentials.AnyAsync(
                        item => item.CredentialId == args.CredentialId &&
                                item.UserHandle == args.UserHandle &&
                                item.MemberId == credential.MemberId &&
                                item.RevokedUtc == null,
                        token)
            }, cancellationToken);

            credential.SignatureCounter = verified.SignCount;
            credential.IsBackedUp = verified.IsBackedUp;
            credential.LastUsedUtc = DateTime.UtcNow;
            AddAudit(credential.MemberId, "identity.passkey.authenticated", credential.Id, credential.MemberId);
            await dbContext.SaveChangesAsync(cancellationToken);

            var flow = ceremony.OnboardingFlow;
            var isPublicDevice = flow?.IsPublicDevice == true;
            var lifetime = isPublicDevice ? TimeSpan.FromHours(2) : TimeSpan.FromDays(30);
            var sessionKind = isPublicDevice ? "public_device" : "standard";
            var jwt = jwtTokenService.CreateToken(credential.Member, "passkey", sessionKind, lifetime);
            var session = new IdentitySession(
                jwt.Token,
                jwt.ExpiresUtc,
                !isPublicDevice,
                "passkey",
                sessionKind,
                flow?.ReturnPath ?? "/enter");
            return AppResult<PasskeyCompletionDto>.Success(new PasskeyCompletionDto(session, null));
        }
        catch when (!cancellationToken.IsCancellationRequested)
        {
            return AppResult<PasskeyCompletionDto>.Forbidden("passkey_verification_failed");
        }
    }

    public async Task<AppResult<PasskeyOptionsDto>> BeginRegistrationAsync(
        Guid memberId,
        Guid? onboardingFlowId,
        bool firstCredentialOnly,
        CancellationToken cancellationToken)
    {
        if (!configuration.PasskeysEnabled)
        {
            return AppResult<PasskeyOptionsDto>.NotFound("passkeys_disabled");
        }

        var member = await dbContext.Members.SingleOrDefaultAsync(item => item.Id == memberId, cancellationToken);
        if (member is null)
        {
            return AppResult<PasskeyOptionsDto>.NotFound("member_not_found");
        }

        if (firstCredentialOnly && await dbContext.MemberPasskeyCredentials.AnyAsync(
                item => item.MemberId == memberId,
                cancellationToken))
        {
            return AppResult<PasskeyOptionsDto>.Forbidden("alpha_passkey_bootstrap_invalid");
        }

        if (onboardingFlowId is Guid flowId)
        {
            var flow = await dbContext.OnboardingFlows.AsNoTracking().SingleOrDefaultAsync(item => item.Id == flowId, cancellationToken);
            if (flow?.IsPublicDevice == true)
            {
                return AppResult<PasskeyOptionsDto>.Forbidden("public_device_registration_disabled");
            }
        }

        member.WebAuthnUserHandle ??= System.Security.Cryptography.RandomNumberGenerator.GetBytes(32);
        var existing = await dbContext.MemberPasskeyCredentials
            .Where(item => item.MemberId == member.Id && item.RevokedUtc == null)
            .Select(item => new PublicKeyCredentialDescriptor(item.CredentialId))
            .ToListAsync(cancellationToken);
        var user = new Fido2User
        {
            Id = member.WebAuthnUserHandle,
            Name = $"member-{member.Id:N}",
            DisplayName = member.DisplayName ?? "ALIFE member"
        };
        var options = fido2.RequestNewCredential(new RequestNewCredentialParams
        {
            User = user,
            ExcludeCredentials = existing,
            AuthenticatorSelection = new AuthenticatorSelection
            {
                AuthenticatorAttachment = null,
                ResidentKey = ResidentKeyRequirement.Required,
                UserVerification = UserVerificationRequirement.Required
            },
            AttestationPreference = AttestationConveyancePreference.None,
            Extensions = new AuthenticationExtensionsClientInputs { CredProps = true }
        });
        var ceremony = new PasskeyCeremony
        {
            Id = Guid.NewGuid(),
            Kind = firstCredentialOnly
                ? PasskeyCeremonyKind.AlphaBootstrapRegistration
                : PasskeyCeremonyKind.Registration,
            MemberId = member.Id,
            OnboardingFlowId = onboardingFlowId,
            OptionsJson = options.ToJson(),
            CreatedUtc = DateTime.UtcNow,
            ExpiresUtc = DateTime.UtcNow.AddMinutes(5)
        };
        dbContext.PasskeyCeremonies.Add(ceremony);
        await dbContext.SaveChangesAsync(cancellationToken);
        return AppResult<PasskeyOptionsDto>.Success(new PasskeyOptionsDto(
            ceremony.Id,
            JsonDocument.Parse(ceremony.OptionsJson).RootElement.Clone()));
    }

    public async Task<AppResult<PasskeyCompletionDto>> CompleteRegistrationAsync(
        Guid ceremonyId,
        JsonElement response,
        string? displayName,
        CancellationToken cancellationToken)
        => await serializableExecutor.ExecuteAsync(
            token => CompleteRegistrationCoreAsync(ceremonyId, response, displayName, token),
            cancellationToken);

    private async Task<AppResult<PasskeyCompletionDto>> CompleteRegistrationCoreAsync(
        Guid ceremonyId,
        JsonElement response,
        string? displayName,
        CancellationToken cancellationToken)
    {
        var ceremony = await dbContext.PasskeyCeremonies.SingleOrDefaultAsync(item => item.Id == ceremonyId, cancellationToken);
        if (!IsActiveRegistration(ceremony) || ceremony!.MemberId is not Guid memberId)
        {
            return AppResult<PasskeyCompletionDto>.Conflict("passkey_challenge_invalid");
        }

        ceremony.ConsumedUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        if (ceremony.Kind == PasskeyCeremonyKind.AlphaBootstrapRegistration &&
            await dbContext.MemberPasskeyCredentials.AnyAsync(
                credential => credential.MemberId == memberId,
                cancellationToken))
        {
            return AppResult<PasskeyCompletionDto>.Forbidden("alpha_passkey_bootstrap_invalid");
        }
        RegisteredPublicKeyCredential registered;
        try
        {
            var raw = JsonSerializer.Deserialize<AuthenticatorAttestationRawResponse>(response.GetRawText())
                      ?? throw new InvalidOperationException("Attestation response is missing.");
            var options = CredentialCreateOptions.FromJson(ceremony.OptionsJson);
            registered = await fido2.MakeNewCredentialAsync(new MakeNewCredentialParams
            {
                AttestationResponse = raw,
                OriginalOptions = options,
                IsCredentialIdUniqueToUserCallback = async (args, token) =>
                    !await dbContext.MemberPasskeyCredentials.AnyAsync(item => item.CredentialId == args.CredentialId, token)
            }, cancellationToken);
        }
        catch when (!cancellationToken.IsCancellationRequested)
        {
            return AppResult<PasskeyCompletionDto>.Forbidden("passkey_verification_failed");
        }

        var credential = new MemberPasskeyCredential
        {
            Id = Guid.NewGuid(),
            MemberId = memberId,
            CredentialId = registered.Id,
            PublicKey = registered.PublicKey,
            UserHandle = registered.User.Id,
            SignatureCounter = registered.SignCount,
            TransportsJson = JsonSerializer.Serialize(registered.Transports.Select(item => item.ToString().ToLowerInvariant())),
            IsBackupEligible = registered.IsBackupEligible,
            IsBackedUp = registered.IsBackedUp,
            DisplayName = NormalizeCredentialName(displayName),
            CreatedUtc = DateTime.UtcNow
        };
        dbContext.MemberPasskeyCredentials.Add(credential);

        IdentitySession? session = null;
        if (ceremony.OnboardingFlowId is Guid flowId)
        {
            var activation = await identityAccessService.CompletePasskeyActivationAsync(
                flowId,
                credential.Id,
                cancellationToken);
            if (!activation.IsSuccess)
            {
                dbContext.MemberPasskeyCredentials.Remove(credential);
                return AppResult<PasskeyCompletionDto>.Conflict(activation.Message ?? "activation_failed");
            }
            session = activation.Value;
        }

        AddAudit(memberId, "identity.passkey.registered", credential.Id, memberId);
        await dbContext.SaveChangesAsync(cancellationToken);
        return AppResult<PasskeyCompletionDto>.Success(new PasskeyCompletionDto(session, ToDto(credential)));
    }

    public async Task<AppResult<IReadOnlyList<PasskeyCredentialDto>>> ListAsync(
        Guid memberId,
        CancellationToken cancellationToken)
    {
        var credentials = await dbContext.MemberPasskeyCredentials.AsNoTracking()
            .Where(item => item.MemberId == memberId && item.RevokedUtc == null)
            .OrderByDescending(item => item.LastUsedUtc ?? item.CreatedUtc)
            .ToListAsync(cancellationToken);
        return AppResult<IReadOnlyList<PasskeyCredentialDto>>.Success(credentials.Select(ToDto).ToArray());
    }

    public async Task<AppResult<bool>> RevokeAsync(
        Guid memberId,
        Guid credentialId,
        CancellationToken cancellationToken)
        => await serializableExecutor.ExecuteAsync(
            token => RevokeCoreAsync(memberId, credentialId, token),
            cancellationToken);

    private async Task<AppResult<bool>> RevokeCoreAsync(
        Guid memberId,
        Guid credentialId,
        CancellationToken cancellationToken)
    {
        var member = await dbContext.Members.Include(item => item.PasskeyCredentials)
            .SingleOrDefaultAsync(item => item.Id == memberId, cancellationToken);
        var credential = member?.PasskeyCredentials.SingleOrDefault(item => item.Id == credentialId && item.RevokedUtc == null);
        if (credential is null)
        {
            return AppResult<bool>.NotFound("passkey_not_found");
        }

        var activeCount = member!.PasskeyCredentials.Count(item => item.RevokedUtc == null);
        if (activeCount <= 1 &&
            (!configuration.LineLegacyEnabled || string.IsNullOrWhiteSpace(member.LineUID)))
        {
            return AppResult<bool>.Conflict("last_authenticator_required");
        }

        credential.RevokedUtc = DateTime.UtcNow;
        AddAudit(memberId, "identity.passkey.revoked", credential.Id, memberId);
        await dbContext.SaveChangesAsync(cancellationToken);
        return AppResult<bool>.Success(true);
    }

    private void AddAudit(Guid actorMemberId, string action, Guid entityId, Guid targetMemberId)
        => dbContext.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            ActorMemberId = actorMemberId,
            Action = action,
            EntityType = nameof(MemberPasskeyCredential),
            EntityId = entityId,
            TargetMemberId = targetMemberId,
            OccurredUtc = DateTime.UtcNow
        });

    private static bool IsActive(PasskeyCeremony? ceremony, PasskeyCeremonyKind kind)
        => ceremony is not null && ceremony.Kind == kind && ceremony.ConsumedUtc is null && ceremony.ExpiresUtc > DateTime.UtcNow;

    private static bool IsActiveRegistration(PasskeyCeremony? ceremony)
        => ceremony is not null &&
           ceremony.Kind is PasskeyCeremonyKind.Registration or PasskeyCeremonyKind.AlphaBootstrapRegistration &&
           ceremony.ConsumedUtc is null &&
           ceremony.ExpiresUtc > DateTime.UtcNow;

    private static string NormalizeCredentialName(string? value)
    {
        var normalized = value?.Trim();
        return string.IsNullOrWhiteSpace(normalized) ? "Passkey" : normalized[..Math.Min(normalized.Length, 120)];
    }

    private static PasskeyCredentialDto ToDto(MemberPasskeyCredential credential)
    {
        string[] transports;
        try
        {
            transports = JsonSerializer.Deserialize<string[]>(credential.TransportsJson ?? "[]") ?? [];
        }
        catch
        {
            transports = [];
        }

        return new PasskeyCredentialDto(
            credential.Id,
            credential.DisplayName,
            credential.CreatedUtc,
            credential.LastUsedUtc,
            credential.IsBackedUp,
            transports);
    }
}
