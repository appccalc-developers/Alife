using System.Text.Json;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Admin.EventPackagePolicies;

public sealed record EventPackagePolicyAdminDto(
    Guid Id,
    Guid? OrganisationId,
    string Version,
    string SchemaVersion,
    JsonElement Rules,
    EventPackageEnforcementMode EnforcementMode,
    DateTime EffectiveFromUtc,
    DateTime? RetiredUtc,
    bool IsPublished,
    Guid PublishedByMemberId,
    DateTime PublishedUtc);

public sealed record PublishEventPackagePolicyRequest(
    Guid? OrganisationId,
    string Version,
    string SchemaVersion,
    JsonElement Rules,
    EventPackageEnforcementMode EnforcementMode,
    DateTime EffectiveFromUtc);

public sealed record EventPackageRolloutReasonDto(string ReasonCode, int Count);

public sealed record EventPackageRolloutReportDto(
    int WindowDays,
    DateTime FromUtc,
    DateTime GeneratedUtc,
    int EvaluatedOperationCount,
    int WouldBlockOperationCount,
    int AffectedEventCount,
    IReadOnlyList<EventPackageRolloutReasonDto> Reasons);

public sealed record ListEventPackagePoliciesQuery(Guid CurrentMemberId, Guid? OrganisationId)
    : IRequest<AppResult<IReadOnlyList<EventPackagePolicyAdminDto>>>;

public sealed record PublishEventPackagePolicyCommand(
    Guid CurrentMemberId,
    PublishEventPackagePolicyRequest Request,
    string? IdempotencyKey)
    : IRequest<AppResult<EventPackagePolicyAdminDto>>;

public sealed record GetEventPackageRolloutReportQuery(Guid CurrentMemberId, int WindowDays = 30)
    : IRequest<AppResult<EventPackageRolloutReportDto>>;

public sealed class GetEventPackageRolloutReportQueryHandler(IAlifeDbContext db)
    : IRequestHandler<GetEventPackageRolloutReportQuery, AppResult<EventPackageRolloutReportDto>>
{
    public async Task<AppResult<EventPackageRolloutReportDto>> Handle(
        GetEventPackageRolloutReportQuery request, CancellationToken ct)
    {
        if (!await ListEventPackagePoliciesQueryHandler.CanManage(db, request.CurrentMemberId, ct))
            return AppResult<EventPackageRolloutReportDto>.Forbidden("Event Package policy administration permission is required.");
        if (request.WindowDays is < 1 or > 90)
            return AppResult<EventPackageRolloutReportDto>.Validation("windowDays must be between 1 and 90.");
        var now = DateTime.UtcNow;
        var from = now.AddDays(-request.WindowDays);
        var audits = await db.AuditLogs.AsNoTracking().Where(x => x.OccurredUtc >= from &&
                (x.Action == "event.published" || x.Action == "event.registration.opened" ||
                 x.Action == "event.execution.confirmed"))
            .Select(x => new { x.EventId, x.MetadataJson }).ToListAsync(ct);
        var evaluations = new List<(Guid? EventId, IReadOnlyList<string> Reasons)>();
        foreach (var audit in audits)
        {
            try
            {
                using var document = JsonDocument.Parse(audit.MetadataJson ?? "{}");
                if (!document.RootElement.TryGetProperty("dryRunReasonCodes", out var value) ||
                    value.ValueKind != JsonValueKind.Array) continue;
                evaluations.Add((audit.EventId, value.EnumerateArray()
                    .Where(x => x.ValueKind == JsonValueKind.String)
                    .Select(x => x.GetString()!).Where(x => !string.IsNullOrWhiteSpace(x)).Distinct().ToArray()));
            }
            catch (JsonException)
            {
                evaluations.Add((audit.EventId, ["event.rollout.invalidAuditMetadata"]));
            }
        }
        var reasons = evaluations.SelectMany(x => x.Reasons).GroupBy(x => x, StringComparer.Ordinal)
            .Select(x => new EventPackageRolloutReasonDto(x.Key, x.Count()))
            .OrderByDescending(x => x.Count).ThenBy(x => x.ReasonCode, StringComparer.Ordinal).ToArray();
        return AppResult<EventPackageRolloutReportDto>.Success(new(
            request.WindowDays, from, now, evaluations.Count, evaluations.Count(x => x.Reasons.Count > 0),
            evaluations.Where(x => x.Reasons.Count > 0).Select(x => x.EventId).Where(x => x.HasValue)
                .Select(x => x!.Value).Distinct().Count(), reasons));
    }
}

public sealed class ListEventPackagePoliciesQueryHandler(IAlifeDbContext db)
    : IRequestHandler<ListEventPackagePoliciesQuery, AppResult<IReadOnlyList<EventPackagePolicyAdminDto>>>
{
    public async Task<AppResult<IReadOnlyList<EventPackagePolicyAdminDto>>> Handle(
        ListEventPackagePoliciesQuery request, CancellationToken ct)
    {
        if (!await CanManage(db, request.CurrentMemberId, ct))
            return AppResult<IReadOnlyList<EventPackagePolicyAdminDto>>.Forbidden("Event Package policy administration permission is required.");
        var policies = await db.EventPackageGovernancePolicyVersions.AsNoTracking()
            .Where(x => x.OrganisationId == request.OrganisationId)
            .OrderByDescending(x => x.EffectiveFromUtc).ThenByDescending(x => x.PublishedUtc)
            .ToListAsync(ct);
        return AppResult<IReadOnlyList<EventPackagePolicyAdminDto>>.Success(policies.Select(ToDto).ToArray());
    }

    internal static Task<bool> CanManage(IAlifeDbContext db, Guid memberId, CancellationToken ct)
        => AdminPlatformRoleHelpers.HasPermissionAsync(db, memberId, AdminPermissionCatalog.ManageEventPackagePolicies, ct);

    internal static EventPackagePolicyAdminDto ToDto(EventPackageGovernancePolicyVersion policy)
    {
        using var document = JsonDocument.Parse(policy.RulesJson);
        return new(policy.Id, policy.OrganisationId, policy.Version, policy.SchemaVersion,
            document.RootElement.Clone(), policy.EnforcementMode, policy.EffectiveFromUtc, policy.RetiredUtc,
            policy.IsPublished, policy.PublishedByMemberId, policy.PublishedUtc);
    }
}

public sealed class PublishEventPackagePolicyCommandHandler(
    IAlifeDbContext db,
    IEventPackageInvalidationService invalidation,
    IEventCacheInvalidationService cacheInvalidation)
    : IRequestHandler<PublishEventPackagePolicyCommand, AppResult<EventPackagePolicyAdminDto>>
{
    public async Task<AppResult<EventPackagePolicyAdminDto>> Handle(PublishEventPackagePolicyCommand command, CancellationToken ct)
    {
        if (!await ListEventPackagePoliciesQueryHandler.CanManage(db, command.CurrentMemberId, ct))
            return AppResult<EventPackagePolicyAdminDto>.Forbidden("Event Package policy administration permission is required.");
        var request = command.Request;
        var key = command.IdempotencyKey?.Trim();
        if (string.IsNullOrWhiteSpace(key) || key.Length > 120)
            return AppResult<EventPackagePolicyAdminDto>.Validation("Idempotency-Key is required and must be at most 120 characters.");
        var validationError = EventPackagePolicyRules.Validate(request);
        if (validationError is not null) return AppResult<EventPackagePolicyAdminDto>.Validation(validationError);
        if (request.OrganisationId.HasValue && !await db.Groups.AsNoTracking().AnyAsync(x => x.Id == request.OrganisationId, ct))
            return AppResult<EventPackagePolicyAdminDto>.Validation("The policy organisation does not exist.");

        var scopeId = request.OrganisationId ?? Guid.Empty;
        var requestHash = EventPackageCanonicalizer.HashCanonical(new { command.CurrentMemberId, request });
        var replay = await db.EventIdempotencyRecords.AsNoTracking().FirstOrDefaultAsync(x =>
            x.Operation == "event.package.policy.publish" && x.ScopeId == scopeId && x.Key == key, ct);
        if (replay is not null)
        {
            if (!string.Equals(replay.RequestHash, requestHash, StringComparison.Ordinal))
                return AppResult<EventPackagePolicyAdminDto>.Conflict("The Idempotency-Key was already used with a different policy request.");
            var existing = await db.EventPackageGovernancePolicyVersions.AsNoTracking().FirstOrDefaultAsync(x => x.Id == replay.ResultEntityId, ct);
            return existing is null
                ? AppResult<EventPackagePolicyAdminDto>.Conflict("The idempotent policy result is no longer available.")
                : AppResult<EventPackagePolicyAdminDto>.Success(ListEventPackagePoliciesQueryHandler.ToDto(existing));
        }

        var now = DateTime.UtcNow;
        var effectiveFrom = AsUtc(request.EffectiveFromUtc);
        if (effectiveFrom > now.AddMinutes(5))
            return AppResult<EventPackagePolicyAdminDto>.Validation("This endpoint publishes an immediately effective policy; effectiveFromUtc cannot be in the future.");
        var currentPolicies = await db.EventPackageGovernancePolicyVersions.Where(x => x.OrganisationId == request.OrganisationId &&
            x.IsPublished && x.EffectiveFromUtc <= now && (!x.RetiredUtc.HasValue || x.RetiredUtc > now)).ToListAsync(ct);
        foreach (var current in currentPolicies) current.RetiredUtc = now;

        var policy = new EventPackageGovernancePolicyVersion
        {
            Id = Guid.NewGuid(), OrganisationId = request.OrganisationId, Version = request.Version.Trim(),
            SchemaVersion = request.SchemaVersion.Trim(), RulesJson = EventPackageCanonicalizer.Serialize(request.Rules),
            EnforcementMode = request.EnforcementMode, EffectiveFromUtc = effectiveFrom,
            IsPublished = true, PublishedByMemberId = command.CurrentMemberId, PublishedUtc = now
        };
        db.EventPackageGovernancePolicyVersions.Add(policy);

        var affectedEvents = await db.GroupEvents.Where(x => !x.IsDeleted &&
            (!request.OrganisationId.HasValue || x.GroupId == request.OrganisationId.Value)).ToListAsync(ct);
        foreach (var groupEvent in affectedEvents)
            await invalidation.InvalidateForMaterialChangeAsync(groupEvent, command.CurrentMemberId,
                "event.package.policyChanged", "governanceCritical", ct);

        db.EventIdempotencyRecords.Add(new EventIdempotencyRecord
        {
            Id = Guid.NewGuid(), Operation = "event.package.policy.publish", ScopeId = scopeId, Key = key,
            RequestHash = requestHash, ResultEntityId = policy.Id, CreatedUtc = now, ExpiresUtc = now.AddDays(7)
        });
        db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(), ActorMemberId = command.CurrentMemberId, Action = "event.package.policy.published",
            EntityType = "EventPackageGovernancePolicyVersion", EntityId = policy.Id, GroupId = request.OrganisationId,
            BeforeJson = EventPackageCanonicalizer.Serialize(currentPolicies.Select(x => new { x.Id, x.Version, x.RetiredUtc })),
            AfterJson = EventPackageCanonicalizer.Serialize(new { policy.Id, policy.Version, policy.SchemaVersion, policy.EnforcementMode, policy.EffectiveFromUtc }),
            MetadataJson = EventPackageCanonicalizer.Serialize(new { affectedEventCount = affectedEvents.Count, activeApprovalsFailClosed = true }),
            OccurredUtc = now
        });
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException) { return AppResult<EventPackagePolicyAdminDto>.Conflict("The policy version or idempotency key already exists."); }
        foreach (var groupId in affectedEvents.Select(x => x.GroupId).Distinct())
            await cacheInvalidation.RemoveGroupEventsAsync(groupId, ct);
        return AppResult<EventPackagePolicyAdminDto>.Success(ListEventPackagePoliciesQueryHandler.ToDto(policy));
    }

    private static DateTime AsUtc(DateTime value) => value.Kind == DateTimeKind.Utc ? value : DateTime.SpecifyKind(value, DateTimeKind.Utc);
}

internal static class EventPackagePolicyRules
{
    private static readonly HashSet<string> AllowedProperties = new(StringComparer.Ordinal)
    {
        "schemaVersion", "tierRules", "authorityByTier", "preEventConfirmationWindowHours", "approvalValidityByTier",
        "materialChangeRules", "conditionWaiverAllowed", "delegationRules", "legacyRollout"
    };

    public static string? Validate(PublishEventPackagePolicyRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Version) || request.Version.Trim().Length > 40) return "Policy version is required and must be at most 40 characters.";
        if (request.SchemaVersion != "1") return "Only governance policy schemaVersion 1 is supported.";
        if (request.Rules.ValueKind != JsonValueKind.Object) return "Policy rules must be a JSON object.";
        if (request.Rules.EnumerateObject().Any(x => !AllowedProperties.Contains(x.Name))) return "Policy rules contain an unknown property and must fail closed.";
        if (!request.Rules.TryGetProperty("schemaVersion", out var schema) || schema.GetString() != "1") return "rules.schemaVersion must be 1.";
        if (!request.Rules.TryGetProperty("preEventConfirmationWindowHours", out var window) || !window.TryGetInt32(out var hours) || hours <= 0) return "A positive preEventConfirmationWindowHours is required.";
        if (!request.Rules.TryGetProperty("tierRules", out var tiers) || tiers.ValueKind != JsonValueKind.Array) return "tierRules is required.";
        var tierEntries = tiers.EnumerateArray().ToArray();
        var tierNames = tierEntries.Select(x => x.TryGetProperty("tier", out var tier) ? tier.GetString() : null).ToHashSet(StringComparer.Ordinal);
        if (!new[] { "light", "standard", "enhanced" }.All(tierNames.Contains)) return "tierRules must define light, standard and enhanced.";
        if (tierEntries.Any(x => !HasArray(x, "whenAnyConfirmedFactCodes") ||
            !HasArray(x, "whenAnyActivityTypeCodes") || !HasArray(x, "whenAnyModuleCodes")))
            return "Every tier rule must include all three trigger-code arrays.";
        if (!request.Rules.TryGetProperty("authorityByTier", out var authority) || authority.ValueKind != JsonValueKind.Object ||
            new[] { "light", "standard", "enhanced" }.Any(x => !authority.TryGetProperty(x, out var rule) ||
                !rule.TryGetProperty("minimumApproverCount", out var count) || !count.TryGetInt32(out var number) || number is < 1 or > 5))
            return "authorityByTier must define minimumApproverCount 1-5 for every tier.";
        if (!request.Rules.TryGetProperty("approvalValidityByTier", out var validity) || validity.ValueKind != JsonValueKind.Object) return "approvalValidityByTier is required.";
        if (new[] { "light", "standard", "enhanced" }.Any(x => !validity.TryGetProperty(x, out var value) ||
            value.ValueKind != JsonValueKind.String || string.IsNullOrWhiteSpace(value.GetString())))
            return "approvalValidityByTier must define a non-empty validity for every tier.";
        if (!request.Rules.TryGetProperty("materialChangeRules", out var changes) || changes.ValueKind != JsonValueKind.Array) return "materialChangeRules is required.";
        if (!request.Rules.TryGetProperty("conditionWaiverAllowed", out var waiver) || waiver.ValueKind is not (JsonValueKind.True or JsonValueKind.False)) return "conditionWaiverAllowed must be boolean.";
        if (!request.Rules.TryGetProperty("delegationRules", out var delegation) || delegation.ValueKind != JsonValueKind.Object) return "delegationRules is required, even when delegation is disabled.";
        if (!delegation.TryGetProperty("enabled", out var delegationEnabled) || delegationEnabled.ValueKind is not (JsonValueKind.True or JsonValueKind.False)) return "delegationRules.enabled must be boolean.";
        if (delegationEnabled.ValueKind == JsonValueKind.True &&
            (!HasArray(delegation, "allowedTiers") || delegation.GetProperty("allowedTiers").EnumerateArray().Any(x =>
                x.ValueKind != JsonValueKind.String || x.GetString() is not ("light" or "standard" or "enhanced"))))
            return "Enabled delegationRules require known allowedTiers.";
        if (!request.Rules.TryGetProperty("legacyRollout", out var rollout) || rollout.ValueKind != JsonValueKind.Object) return "legacyRollout is required.";
        if (!rollout.TryGetProperty("effectiveFromUtc", out _) || !rollout.TryGetProperty("transitionDeadlineUtc", out _) ||
            !rollout.TryGetProperty("cohortRule", out _) || !HasArray(rollout, "safetyCriticalModuleCodes") ||
            !rollout.TryGetProperty("transitionByMode", out var transitions) || transitions.ValueKind != JsonValueKind.Object)
            return "legacyRollout is incomplete.";
        return null;
    }

    private static bool HasArray(JsonElement value, string propertyName)
        => value.TryGetProperty(propertyName, out var property) && property.ValueKind == JsonValueKind.Array;
}
