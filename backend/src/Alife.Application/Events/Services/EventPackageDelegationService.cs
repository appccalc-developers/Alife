using System.Text.Json;
using Alife.Application.Admin;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Services;

public interface IEventPackageDelegationService
{
    Task<AppResult<IReadOnlyList<EventPackageApprovalDelegationDto>>> ListAsync(Guid organisationId, Guid memberId, CancellationToken ct);
    Task<AppResult<EventPackageApprovalDelegationDto>> GrantAsync(Guid memberId, GrantEventPackageApprovalDelegationRequest request,
        string? idempotencyKey, CancellationToken ct);
    Task<AppResult<EventPackageApprovalDelegationDto>> RevokeAsync(Guid delegationId, Guid memberId,
        RevokeEventPackageApprovalDelegationRequest request, string? ifMatch, string? idempotencyKey, CancellationToken ct);
}

public sealed class EventPackageDelegationService(IAlifeDbContext db) : IEventPackageDelegationService
{
    private const string Permission = "event.package.decide";

    public async Task<AppResult<IReadOnlyList<EventPackageApprovalDelegationDto>>> ListAsync(
        Guid organisationId, Guid memberId, CancellationToken ct)
    {
        var canManage = await CanManageAsync(organisationId, memberId, ct);
        var items = await db.EventPackageApprovalDelegations.AsNoTracking().Where(x => x.OrganisationId == organisationId &&
            (canManage || x.DelegatedToMemberId == memberId)).OrderByDescending(x => x.GrantedUtc).ToListAsync(ct);
        if (!canManage && items.Count == 0)
            return AppResult<IReadOnlyList<EventPackageApprovalDelegationDto>>.Forbidden("Delegation management or a delegation assigned to you is required.");
        return AppResult<IReadOnlyList<EventPackageApprovalDelegationDto>>.Success(items.Select(ToDto).ToArray());
    }

    public async Task<AppResult<EventPackageApprovalDelegationDto>> GrantAsync(Guid memberId,
        GrantEventPackageApprovalDelegationRequest request, string? idempotencyKey, CancellationToken ct)
    {
        if (!await CanManageAsync(request.OrganisationId, memberId, ct))
            return AppResult<EventPackageApprovalDelegationDto>.Forbidden("Organisation leadership or Package-policy administration is required to grant delegation.");
        if (!string.Equals(request.PermissionCode, Permission, StringComparison.Ordinal))
            return AppResult<EventPackageApprovalDelegationDto>.Validation("Only event.package.decide can be delegated here.");
        var keyError = ValidateKey(idempotencyKey);
        if (keyError is not null) return AppResult<EventPackageApprovalDelegationDto>.Validation(keyError);
        if ((request.ScopeType == EventPackageDelegationScopeType.Organisation) != !request.ScopeId.HasValue)
            return AppResult<EventPackageApprovalDelegationDto>.Validation("Organisation scope has no scopeId; Event and Occurrence scopes require one.");
        var starts = AsUtc(request.StartsUtc); var expires = AsUtc(request.ExpiresUtc); var now = DateTime.UtcNow;
        if (expires <= starts || expires <= now || expires - starts > TimeSpan.FromDays(90))
            return AppResult<EventPackageApprovalDelegationDto>.Validation("Delegation must have a future end, follow its start, and last no more than 90 days.");
        if (!await ScopeBelongsToOrganisationAsync(request, ct))
            return AppResult<EventPackageApprovalDelegationDto>.Validation("The delegation scope does not belong to the organisation.");
        if (!await db.GroupMemberships.AsNoTracking().AnyAsync(x => x.GroupId == request.OrganisationId &&
            x.MemberId == request.DelegatedToMemberId && x.Status == MembershipStatus.Approved, ct))
            return AppResult<EventPackageApprovalDelegationDto>.Validation("The delegate must remain an approved member of the organisation.");
        if (!await DelegationEnabledAsync(db, request.OrganisationId, ct))
            return AppResult<EventPackageApprovalDelegationDto>.Conflict("The current governance policy does not enable approval delegation.");

        var key = idempotencyKey!.Trim();
        var requestHash = EventPackageCanonicalizer.HashCanonical(new { memberId, request });
        var replay = await db.EventIdempotencyRecords.AsNoTracking().FirstOrDefaultAsync(x =>
            x.Operation == "event.package.delegation.grant" && x.ScopeId == request.OrganisationId && x.Key == key, ct);
        if (replay is not null)
        {
            if (replay.RequestHash != requestHash) return AppResult<EventPackageApprovalDelegationDto>.Conflict("The Idempotency-Key was reused with another delegation request.");
            var existing = await db.EventPackageApprovalDelegations.AsNoTracking().FirstOrDefaultAsync(x => x.Id == replay.ResultEntityId, ct);
            return existing is null ? AppResult<EventPackageApprovalDelegationDto>.Conflict("The idempotent delegation result is unavailable.")
                : AppResult<EventPackageApprovalDelegationDto>.Success(ToDto(existing));
        }
        if (await db.EventPackageApprovalDelegations.AsNoTracking().AnyAsync(x =>
            x.OrganisationId == request.OrganisationId && x.ScopeType == request.ScopeType && x.ScopeId == request.ScopeId &&
            x.DelegatedToMemberId == request.DelegatedToMemberId && x.PermissionCode == Permission && x.RevokedUtc == null &&
            x.StartsUtc < expires && x.ExpiresUtc > starts, ct))
            return AppResult<EventPackageApprovalDelegationDto>.Conflict("An overlapping active delegation already exists for this member and scope.");

        var entity = new EventPackageApprovalDelegation
        {
            Id = Guid.NewGuid(), OrganisationId = request.OrganisationId, ScopeType = request.ScopeType,
            ScopeId = request.ScopeId, PermissionCode = Permission, DelegatedToMemberId = request.DelegatedToMemberId,
            StartsUtc = starts, ExpiresUtc = expires, GrantedByMemberId = memberId, GrantedUtc = now
        };
        db.EventPackageApprovalDelegations.Add(entity);
        AddIdempotency("event.package.delegation.grant", request.OrganisationId, key, requestHash, entity.Id, now);
        AddAudit("event.package.delegation.granted", entity, memberId, now, null, new
        {
            entity.OrganisationId, entity.ScopeType, entity.ScopeId, entity.PermissionCode,
            entity.DelegatedToMemberId, entity.StartsUtc, entity.ExpiresUtc
        });
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException) { return AppResult<EventPackageApprovalDelegationDto>.Conflict("The delegation could not be created."); }
        return AppResult<EventPackageApprovalDelegationDto>.Success(ToDto(entity));
    }

    public async Task<AppResult<EventPackageApprovalDelegationDto>> RevokeAsync(Guid delegationId, Guid memberId,
        RevokeEventPackageApprovalDelegationRequest request, string? ifMatch, string? idempotencyKey, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Reason.En) || string.IsNullOrWhiteSpace(request.Reason.Zh))
            return AppResult<EventPackageApprovalDelegationDto>.Validation("A bilingual revocation reason is required.");
        var keyError = ValidateKey(idempotencyKey);
        if (keyError is not null) return AppResult<EventPackageApprovalDelegationDto>.Validation(keyError);
        var entity = await db.EventPackageApprovalDelegations.FirstOrDefaultAsync(x => x.Id == delegationId, ct);
        if (entity is null) return AppResult<EventPackageApprovalDelegationDto>.NotFound("Delegation not found.");
        if (entity.GrantedByMemberId != memberId && !await CanManageAsync(entity.OrganisationId, memberId, ct))
            return AppResult<EventPackageApprovalDelegationDto>.Forbidden("The grantor or current organisation authority is required to revoke delegation.");
        var requestHash = EventPackageCanonicalizer.HashCanonical(new { memberId, request });
        var replay = await db.EventIdempotencyRecords.AsNoTracking().FirstOrDefaultAsync(x =>
            x.Operation == "event.package.delegation.revoke" && x.ScopeId == entity.Id && x.Key == idempotencyKey!.Trim(), ct);
        if (replay is not null)
            return replay.RequestHash != requestHash
                ? AppResult<EventPackageApprovalDelegationDto>.Conflict("The Idempotency-Key was reused with another revocation request.")
                : AppResult<EventPackageApprovalDelegationDto>.Success(ToDto(entity));
        if (!string.Equals(ifMatch?.Trim(), ETag(entity), StringComparison.Ordinal))
            return AppResult<EventPackageApprovalDelegationDto>.PreconditionFailed("The delegation changed; reload before revoking it.");
        if (entity.RevokedUtc.HasValue) return AppResult<EventPackageApprovalDelegationDto>.Conflict("The delegation is already revoked.");
        var now = DateTime.UtcNow;
        entity.RevokedByMemberId = memberId; entity.RevokedUtc = now;
        entity.RevocationReasonEn = request.Reason.En.Trim(); entity.RevocationReasonZh = request.Reason.Zh.Trim();
        entity.ConcurrencyToken = Guid.NewGuid();
        AddIdempotency("event.package.delegation.revoke", entity.Id, idempotencyKey!.Trim(),
            requestHash, entity.Id, now);
        AddAudit("event.package.delegation.revoked", entity, memberId, now, new { active = true },
            new { active = false, entity.RevokedUtc, reason = request.Reason });
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException) { return AppResult<EventPackageApprovalDelegationDto>.Conflict("event.package.delegation.concurrentChange"); }
        catch (DbUpdateException) { return AppResult<EventPackageApprovalDelegationDto>.Conflict("The delegation revocation conflicted with another request."); }
        return AppResult<EventPackageApprovalDelegationDto>.Success(ToDto(entity));
    }

    internal static async Task<EventPackageApprovalDelegation?> FindActiveDecisionDelegationAsync(
        IAlifeDbContext db, GroupEvent groupEvent, EventPackage package, Guid memberId, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        if (!await DelegationEnabledForTierAsync(db, package.GovernancePolicyVersionId, package.GovernanceTier, ct)) return null;
        var approvedMember = await db.GroupMemberships.AsNoTracking().AnyAsync(x => x.GroupId == groupEvent.GroupId &&
            x.MemberId == memberId && x.Status == MembershipStatus.Approved, ct);
        if (!approvedMember) return null;
        return await db.EventPackageApprovalDelegations.AsNoTracking().Where(x =>
            x.OrganisationId == groupEvent.GroupId && x.DelegatedToMemberId == memberId && x.PermissionCode == Permission &&
            x.StartsUtc <= now && x.ExpiresUtc > now && x.RevokedUtc == null &&
            (x.ScopeType == EventPackageDelegationScopeType.Organisation ||
             (x.ScopeType == EventPackageDelegationScopeType.Event && x.ScopeId == groupEvent.Id) ||
             (x.ScopeType == EventPackageDelegationScopeType.Occurrence && package.ScopeType == EventPackageScopeType.Occurrence && x.ScopeId == package.ScopeId)))
            .OrderBy(x => x.ExpiresUtc).FirstOrDefaultAsync(ct);
    }

    internal static async Task<bool> HasActiveViewDelegationAsync(
        IAlifeDbContext db, GroupEvent groupEvent, Guid memberId, CancellationToken ct)
    {
        if (!await DelegationEnabledAsync(db, groupEvent.GroupId, ct)) return false;
        var now = DateTime.UtcNow;
        if (!await db.GroupMemberships.AsNoTracking().AnyAsync(x => x.GroupId == groupEvent.GroupId &&
            x.MemberId == memberId && x.Status == MembershipStatus.Approved, ct)) return false;
        return await db.EventPackageApprovalDelegations.AsNoTracking().AnyAsync(x =>
            x.OrganisationId == groupEvent.GroupId && x.DelegatedToMemberId == memberId &&
            x.PermissionCode == Permission && x.StartsUtc <= now && x.ExpiresUtc > now && x.RevokedUtc == null &&
            (x.ScopeType == EventPackageDelegationScopeType.Organisation ||
             (x.ScopeType == EventPackageDelegationScopeType.Event && x.ScopeId == groupEvent.Id) ||
             (x.ScopeType == EventPackageDelegationScopeType.Occurrence &&
              db.EventOccurrences.Any(o => o.Id == x.ScopeId && o.EventId == groupEvent.Id))), ct);
    }

    private async Task<bool> CanManageAsync(Guid organisationId, Guid memberId, CancellationToken ct)
        => await EventCompositionPersistence.HasDirectGroupLeadershipAsync(db, organisationId, memberId, ct) ||
           await AdminPlatformRoleHelpers.HasPermissionAsync(db, memberId, AdminPermissionCatalog.ManageEventPackagePolicies, ct);

    private async Task<bool> ScopeBelongsToOrganisationAsync(GrantEventPackageApprovalDelegationRequest request, CancellationToken ct)
        => request.ScopeType switch
        {
            EventPackageDelegationScopeType.Organisation => true,
            EventPackageDelegationScopeType.Event => await db.GroupEvents.AsNoTracking().AnyAsync(x => x.Id == request.ScopeId && x.GroupId == request.OrganisationId, ct),
            EventPackageDelegationScopeType.Occurrence => await db.EventOccurrences.AsNoTracking().AnyAsync(x => x.Id == request.ScopeId && x.Event.GroupId == request.OrganisationId, ct),
            _ => false
        };

    internal static async Task<bool> DelegationEnabledAsync(IAlifeDbContext db, Guid organisationId, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var policy = await db.EventPackageGovernancePolicyVersions.AsNoTracking().Where(x => x.IsPublished && x.EffectiveFromUtc <= now &&
            (!x.RetiredUtc.HasValue || x.RetiredUtc > now) && (x.OrganisationId == organisationId || x.OrganisationId == null))
            .OrderByDescending(x => x.OrganisationId == organisationId).ThenByDescending(x => x.EffectiveFromUtc).FirstOrDefaultAsync(ct);
        return policy is not null && DelegationSettings(policy.RulesJson).Enabled;
    }

    private static async Task<bool> DelegationEnabledForTierAsync(IAlifeDbContext db, Guid policyId, EventGovernanceTier tier, CancellationToken ct)
    {
        var rules = await db.EventPackageGovernancePolicyVersions.AsNoTracking().Where(x => x.Id == policyId).Select(x => x.RulesJson).FirstOrDefaultAsync(ct);
        if (rules is null) return false;
        var settings = DelegationSettings(rules);
        return settings.Enabled && settings.AllowedTiers.Contains(tier.ToString(), StringComparer.OrdinalIgnoreCase);
    }

    private static (bool Enabled, string[] AllowedTiers) DelegationSettings(string rulesJson)
    {
        try
        {
            using var document = JsonDocument.Parse(rulesJson);
            var rules = document.RootElement.GetProperty("delegationRules");
            var enabled = rules.TryGetProperty("enabled", out var value) && value.ValueKind == JsonValueKind.True;
            var tiers = rules.TryGetProperty("allowedTiers", out var allowed) && allowed.ValueKind == JsonValueKind.Array
                ? allowed.EnumerateArray().Select(x => x.GetString()).Where(x => x is not null).Cast<string>().ToArray() : [];
            return (enabled, tiers);
        }
        catch (Exception exception) when (exception is JsonException or InvalidOperationException) { return (false, []); }
    }

    private void AddIdempotency(string operation, Guid scopeId, string key, string hash, Guid resultId, DateTime now)
        => db.EventIdempotencyRecords.Add(new EventIdempotencyRecord { Id = Guid.NewGuid(), Operation = operation,
            ScopeId = scopeId, Key = key, RequestHash = hash, ResultEntityId = resultId, CreatedUtc = now, ExpiresUtc = now.AddDays(7) });

    private void AddAudit(string action, EventPackageApprovalDelegation entity, Guid actor, DateTime now, object? before, object after)
        => db.AuditLogs.Add(new AuditLog { Id = Guid.NewGuid(), ActorMemberId = actor, Action = action,
            EntityType = "EventPackageApprovalDelegation", EntityId = entity.Id, GroupId = entity.OrganisationId,
            BeforeJson = before is null ? null : EventPackageCanonicalizer.Serialize(before),
            AfterJson = EventPackageCanonicalizer.Serialize(after), OccurredUtc = now });

    private static EventPackageApprovalDelegationDto ToDto(EventPackageApprovalDelegation x)
        => new(x.Id, x.OrganisationId, x.ScopeType, x.ScopeId, x.PermissionCode, x.DelegatedToMemberId,
            x.StartsUtc, x.ExpiresUtc, x.GrantedByMemberId, x.GrantedUtc, x.RevokedByMemberId, x.RevokedUtc,
            x.RevokedUtc.HasValue ? new(x.RevocationReasonEn ?? "", x.RevocationReasonZh ?? "") : null, ETag(x));
    private static string ETag(EventPackageApprovalDelegation x) => $"\"event-package-delegation-{x.ConcurrencyToken:N}\"";
    private static string? ValidateKey(string? value) => string.IsNullOrWhiteSpace(value) || value.Trim().Length > 120
        ? "Idempotency-Key is required and must be at most 120 characters." : null;
    private static DateTime AsUtc(DateTime value) => value.Kind == DateTimeKind.Utc ? value : DateTime.SpecifyKind(value, DateTimeKind.Utc);
}
