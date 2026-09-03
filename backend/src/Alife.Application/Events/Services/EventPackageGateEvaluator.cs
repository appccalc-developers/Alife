using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Application.Events.Dtos;
using System.Text.Json;

namespace Alife.Application.Events.Services;

public sealed record EventPackageGateEvaluation(
    EventLifecycleGate Gate,
    EventPackageEnforcementMode EnforcementMode,
    bool Allowed,
    bool RequirementsSatisfied,
    IReadOnlyList<string> ReasonCodes);

/// <summary>
/// The single in-process authority for evaluating stored Package approval evidence at lifecycle gates.
/// Source-vector freshness is added by command services because it requires database reads.
/// </summary>
public static class EventPackageGateEvaluator
{
    public static EventPackageGateEvaluation Evaluate(
        EventLifecycleGate gate,
        EventPackageEnforcementMode enforcementMode,
        EventPackage? package,
        DateTime utcNow)
    {
        var reasons = new List<string>();
        if (package is null)
        {
            reasons.Add(Reason(gate, "packageMissing"));
        }
        else
        {
            if (package.Status is not (EventPackageStatus.Approved or EventPackageStatus.ApprovedWithConditions) ||
                package.ApprovalValidityStatus != EventPackageApprovalValidity.Active)
                reasons.Add(Reason(gate, "packageNotApproved"));

            var approvalDecisions = package.Decisions.Where(x =>
                x.DecisionType is EventPackageDecisionType.Approve or EventPackageDecisionType.ApproveWithConditions).ToArray();
            var approval = approvalDecisions.OrderByDescending(x => x.DecidedUtc).FirstOrDefault();
            if (approval is null)
                reasons.Add(Reason(gate, "approvalDecisionMissing"));
            else
            {
                var minimumApproverCount = ReadMinimumApproverCount(approval.DecisionAuthoritySnapshotJson) ?? 1;
                var activeApprovalCount = approvalDecisions.Count(x => x.InvalidatedReasonCode == null &&
                    (!x.ExpiresUtc.HasValue || x.ExpiresUtc > utcNow) &&
                    !package.Decisions.Any(revocation => revocation.DecisionType == EventPackageDecisionType.Revoke &&
                        revocation.RevokedByDecisionId == x.Id));
                if (approvalDecisions.Any(x => x.ExpiresUtc is { } expiresUtc && expiresUtc <= utcNow) &&
                    activeApprovalCount < minimumApproverCount)
                    reasons.Add(Reason(gate, "approvalExpired"));
                if (activeApprovalCount < minimumApproverCount)
                    reasons.Add(Reason(gate, "approvalQuorumMissing"));
            }

            var unresolvedConditions = package.Conditions.Where(x => x.AppliesToGate == gate &&
                x.Status is not (EventPackageConditionStatus.Verified or EventPackageConditionStatus.Waived)).ToArray();
            if (unresolvedConditions.Any(x => x.Status == EventPackageConditionStatus.Expired || x.DueUtc <= utcNow))
                reasons.Add(Reason(gate, "conditionExpired"));
            if (unresolvedConditions.Any(x => x.Status != EventPackageConditionStatus.Expired && x.DueUtc > utcNow))
                reasons.Add(Reason(gate, "conditionOpen"));
            if (HasApplicableReadinessBlocker(package, gate))
                reasons.Add(Reason(gate, "readinessBlocked"));
        }

        var distinctReasons = reasons.Distinct(StringComparer.Ordinal).ToArray();
        return new(gate, enforcementMode,
            enforcementMode != EventPackageEnforcementMode.Enforced || distinctReasons.Length == 0,
            distinctReasons.Length == 0,
            distinctReasons);
    }

    public static string Reason(EventLifecycleGate gate, string suffix)
        => $"event.{gate.ToString().ToLowerInvariant()}.{suffix}";

    private static int? ReadMinimumApproverCount(string authoritySnapshotJson)
    {
        try
        {
            using var document = System.Text.Json.JsonDocument.Parse(authoritySnapshotJson);
            return document.RootElement.TryGetProperty("minimumApproverCount", out var value) && value.TryGetInt32(out var count)
                ? count : null;
        }
        catch (System.Text.Json.JsonException) { return null; }
    }

    private static bool HasApplicableReadinessBlocker(EventPackage package, EventLifecycleGate gate)
    {
        EventPackageManifestDto? manifest;
        try { manifest = JsonSerializer.Deserialize<EventPackageManifestDto>(package.ManifestJson, EventCompositionEngine.CreateJsonOptions()); }
        catch (JsonException) { return true; }
        if (manifest?.Modules is null) return false;
        if (manifest.Blockers?.Count > 0) return true;
        return manifest.Modules.Any(module => module.Blockers.Count > 0 && gate switch
        {
            EventLifecycleGate.Publish or EventLifecycleGate.Execute => module.ModuleCode is
                "PLACE.RESOURCE" or "SAFETY.RAM" or "SAFEGUARDING.CHILD" or "MONEY.FINANCE" or "MOVE.STAY",
            EventLifecycleGate.Registration => module.ModuleCode is "PEOPLE.REGISTRATION" or "MONEY.FINANCE" or "SAFEGUARDING.CHILD",
            EventLifecycleGate.Payment => module.ModuleCode is "PEOPLE.REGISTRATION" or "MONEY.FINANCE",
            _ => true
        });
    }
}
