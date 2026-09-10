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
    DateTime PublishedUtc,
    string? PublishedByDisplayName = null);

public sealed record PublishEventPackagePolicyRequest(
    Guid? OrganisationId,
    string Version,
    string SchemaVersion,
    JsonElement Rules,
    EventPackageEnforcementMode EnforcementMode,
    DateTime EffectiveFromUtc,
    Guid? ExpectedCurrentPolicyId = null,
    Guid? SourcePolicyId = null,
    string? ImpactToken = null);

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
        var policies = await db.EventPackageGovernancePolicyVersions.AsNoTracking().Include(x => x.PublishedByMember)
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
            policy.IsPublished, policy.PublishedByMemberId, policy.PublishedUtc, policy.PublishedByMember?.DisplayName);
    }
}

public sealed class PublishEventPackagePolicyCommandHandler(
    IAlifeDbContext db,
    IEventPackageInvalidationService invalidation,
    IEventCacheInvalidationService cacheInvalidation,
    IEventActivityTemplateCatalog? templates = null)
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
        var validationError = EventPackagePolicyRules.Validate(request, templates is null ? null :
            (await templates.ListAsync(true, ct)).Select(x => x.Definition.Code).ToHashSet());
        if (validationError is not null) return AppResult<EventPackagePolicyAdminDto>.Validation(validationError);
        if (request.OrganisationId.HasValue && !await db.Groups.AsNoTracking().AnyAsync(x => x.Id == request.OrganisationId, ct))
            return AppResult<EventPackagePolicyAdminDto>.Validation("The policy organisation does not exist.");

        await using var transaction = await db.BeginSerializableTransactionAsync(ct);
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
        var effectiveFrom = now;
        if (AsUtc(request.EffectiveFromUtc) > now.AddMinutes(5))
            return AppResult<EventPackagePolicyAdminDto>.Validation("This endpoint publishes an immediately effective policy; effectiveFromUtc cannot be in the future.");
        var currentPolicies = await db.EventPackageGovernancePolicyVersions.Where(x => x.OrganisationId == request.OrganisationId &&
            x.IsPublished && (!x.RetiredUtc.HasValue || x.RetiredUtc > now)).ToListAsync(ct);
        var impact = await EventPackagePolicyEditor.Impact(db, request.OrganisationId, ct);
        if (request.ExpectedCurrentPolicyId.HasValue && request.ExpectedCurrentPolicyId != (impact.CurrentPolicyId ?? Guid.Empty))
            return AppResult<EventPackagePolicyAdminDto>.Conflict("The current policy changed. Refresh and review again.");
        if (request.ImpactToken is not null && request.ImpactToken != impact.ImpactToken)
            return AppResult<EventPackagePolicyAdminDto>.Conflict("Affected approvals changed. Preview and review again.");
        if (request.SourcePolicyId.HasValue)
        {
            var source = await db.EventPackageGovernancePolicyVersions.AsNoTracking().FirstOrDefaultAsync(x =>
                x.Id == request.SourcePolicyId && x.OrganisationId == request.OrganisationId && x.IsPublished, ct);
            if (source is null || source.SchemaVersion != request.SchemaVersion)
                return AppResult<EventPackagePolicyAdminDto>.Validation("The source policy is unavailable or incompatible.");
        }
        var previous = currentPolicies.Select(x => new { x.Id, x.Version, x.RetiredUtc }).ToArray();
        foreach (var current in currentPolicies) current.RetiredUtc = now;

        var policy = new EventPackageGovernancePolicyVersion
        {
            Id = Guid.NewGuid(), OrganisationId = request.OrganisationId, Version = request.Version.Trim(),
            SchemaVersion = request.SchemaVersion.Trim(), RulesJson = EventPackageCanonicalizer.Serialize(request.Rules),
            EnforcementMode = request.EnforcementMode, EffectiveFromUtc = effectiveFrom,
            IsPublished = true, PublishedByMemberId = command.CurrentMemberId, PublishedUtc = now
        };
        db.EventPackageGovernancePolicyVersions.Add(policy);

        var affectedEvents = await EventPackagePolicyEditor.AffectedEvents(db, request.OrganisationId, now).ToListAsync(ct);
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
            BeforeJson = EventPackageCanonicalizer.Serialize(previous),
            AfterJson = EventPackageCanonicalizer.Serialize(new { policy.Id, policy.Version, policy.SchemaVersion, policy.EnforcementMode, policy.EffectiveFromUtc }),
            MetadataJson = EventPackageCanonicalizer.Serialize(new { affectedEventCount = affectedEvents.Count, affectedApprovalCount = impact.AffectedApprovalCount, request.SourcePolicyId, activeApprovalsFailClosed = true }),
            OccurredUtc = now
        });
        try { await db.SaveChangesAsync(ct); if (transaction is not null) await transaction.CommitAsync(ct); }
        catch (DbUpdateException) { return AppResult<EventPackagePolicyAdminDto>.Conflict("The policy version or idempotency key already exists."); }
        foreach (var groupId in affectedEvents.Select(x => x.GroupId).Distinct())
            await cacheInvalidation.RemoveGroupEventsAsync(groupId, ct);
        return AppResult<EventPackagePolicyAdminDto>.Success(ListEventPackagePoliciesQueryHandler.ToDto(policy));
    }

    private static DateTime AsUtc(DateTime value) => value.Kind == DateTimeKind.Utc ? value : DateTime.SpecifyKind(value, DateTimeKind.Utc);
}

internal static class EventPackagePolicyRules
{
    private static readonly string[] Tiers = ["light", "standard", "enhanced"];
    public static string? Validate(PublishEventPackagePolicyRequest request, IReadOnlySet<string>? activityTypes = null)
    {
        try { return ValidateCore(request, activityTypes ?? EventCompositionDefinitions.ActivityTypesByCode.Keys.ToHashSet()); }
        catch (Exception ex) when (ex is InvalidOperationException or FormatException or OverflowException or KeyNotFoundException)
        { return "Policy rules contain an invalid value or unsupported structure."; }
    }

    private static string? ValidateCore(PublishEventPackagePolicyRequest request, IReadOnlySet<string> activityTypes)
    {
        if (string.IsNullOrWhiteSpace(request.Version) || request.Version.Trim().Length > 40) return "Policy version is required and must be at most 40 characters.";
        if (request.SchemaVersion != "1" || !Enum.IsDefined(request.EnforcementMode)) return "Unsupported policy schema or enforcement mode.";
        var r = request.Rules;
        if (!Shape(r, ["schemaVersion", "tierRules", "authorityByTier", "preEventConfirmationWindowHours", "approvalValidityByTier", "materialChangeRules", "conditionWaiverAllowed", "delegationRules", "legacyRollout"])) return "Policy rules contain missing or unknown properties.";
        if (r.GetProperty("schemaVersion").GetString() != "1") return "rules.schemaVersion must be 1.";
        if (!r.GetProperty("preEventConfirmationWindowHours").TryGetInt32(out var hours) || hours <= 0) return "A positive confirmation window is required.";
        var tiers = r.GetProperty("tierRules").EnumerateArray().ToArray();
        if (tiers.Length != 3 || !tiers.Select(x => x.GetProperty("tier").GetString()).ToHashSet().SetEquals(Tiers)) return "Define each approval tier exactly once.";
        foreach (var tier in tiers)
        {
            if (!Shape(tier, ["tier", "whenAnyConfirmedFactCodes", "whenAnyActivityTypeCodes", "whenAnyModuleCodes"]) ||
                !Codes(tier.GetProperty("whenAnyConfirmedFactCodes"), EventPackagePolicyEditor.Facts.Select(x => x.Code).ToHashSet()) ||
                !Codes(tier.GetProperty("whenAnyActivityTypeCodes"), activityTypes) ||
                !Codes(tier.GetProperty("whenAnyModuleCodes"), EventCompositionDefinitions.ModulesByCode.Keys.ToHashSet())) return "Select known, distinct policy triggers.";
        }
        var authority = r.GetProperty("authorityByTier");
        var validity = r.GetProperty("approvalValidityByTier");
        if (!Shape(authority, Tiers) || !Shape(validity, Tiers)) return "Define authority and validity for every tier.";
        foreach (var tier in Tiers)
        {
            var rule = authority.GetProperty(tier);
            if (!Shape(rule, ["minimumApproverCount"]) || !rule.GetProperty("minimumApproverCount").TryGetInt32(out var count) || count is < 1 or > 5) return "Approval count must be between 1 and 5.";
            var value = validity.GetProperty(tier);
            if (value.ValueKind != JsonValueKind.String || string.IsNullOrWhiteSpace(value.GetString())) return "Approval validity is required for every tier.";
            var duration = System.Xml.XmlConvert.ToTimeSpan(value.GetString()!);
            if (duration <= TimeSpan.Zero || duration.TotalDays > 3650) return "Approval validity must be positive and at most 3650 days.";
        }
        if (r.GetProperty("materialChangeRules").ValueKind != JsonValueKind.Array) return "Material change rules must be an array.";
        if (r.GetProperty("conditionWaiverAllowed").ValueKind is not (JsonValueKind.True or JsonValueKind.False)) return "Condition waiver must be boolean.";
        var delegation = r.GetProperty("delegationRules");
        if (!Shape(delegation, ["enabled"], ["allowedTiers"]) || delegation.GetProperty("enabled").ValueKind is not (JsonValueKind.True or JsonValueKind.False)) return "Invalid delegation rules.";
        if (delegation.TryGetProperty("allowedTiers", out var allowed) && !Codes(allowed, Tiers.ToHashSet())) return "Unknown delegation tier.";
        if (delegation.GetProperty("enabled").GetBoolean() && (allowed.ValueKind != JsonValueKind.Array || allowed.GetArrayLength() == 0)) return "Select at least one delegation tier.";
        var rollout = r.GetProperty("legacyRollout");
        if (!Shape(rollout, ["effectiveFromUtc", "transitionDeadlineUtc", "cohortRule", "safetyCriticalModuleCodes", "transitionByMode"])) return "Invalid rollout structure.";
        if (!rollout.GetProperty("effectiveFromUtc").TryGetDateTimeOffset(out var start) ||
            !rollout.GetProperty("transitionDeadlineUtc").TryGetDateTimeOffset(out var end) || end <= start) return "Transition deadline must follow its start.";
        if (rollout.GetProperty("cohortRule").GetString() != "new-events-first" ||
            !Codes(rollout.GetProperty("safetyCriticalModuleCodes"), EventCompositionDefinitions.ModulesByCode.Keys.ToHashSet())) return "Unknown rollout rules.";
        var transitions = rollout.GetProperty("transitionByMode");
        if (!Shape(transitions, [], ["off", "dryRun", "enforced"]) || transitions.EnumerateObject().Any(x => x.Value.GetString() != (x.Name switch { "off" => "legacyReadOnlyPackage", "dryRun" => "timeLimitedCompatibility", _ => "formalPackageRequired" }))) return "Unknown rollout transition.";
        return null;
    }

    private static bool Shape(JsonElement value, string[] required, string[]? optional = null)
    {
        if (value.ValueKind != JsonValueKind.Object) return false;
        var names = value.EnumerateObject().Select(x => x.Name).ToArray();
        return names.Length == names.Distinct().Count() && required.All(x => names.Contains(x)) && names.All(x => required.Contains(x) || (optional?.Contains(x) ?? false));
    }
    private static bool Codes(JsonElement value, IReadOnlySet<string> known)
    {
        if (value.ValueKind != JsonValueKind.Array) return false;
        var values = value.EnumerateArray().Select(x => x.GetString()).ToArray();
        return values.All(x => x is not null && known.Contains(x)) && values.Distinct().Count() == values.Length;
    }
}
