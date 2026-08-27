using System.Text.Json;
using System.Text.Json.Serialization;
using Alife.Application.Events.Dtos;
using Alife.Domain.Entities;
using Alife.Domain.Enums;

namespace Alife.Application.Events.Services;

public static class EventSafeguardingReadiness
{
    public const string LeadRoleKey = "SAFEGUARDING.CHILD:safeguarding.lead";
    public const string CheckInWorkerRoleKey = "SAFEGUARDING.CHILD:check-in.worker";
    private static readonly HashSet<string> SupportedRoleKeys = [LeadRoleKey, CheckInWorkerRoleKey];

    public static SafeguardingPolicyRequirements? ParsePolicy(string json)
    {
        try
        {
            var value = JsonSerializer.Deserialize<SafeguardingPolicyRequirements>(json, Options);
            if (value is null || value.SchemaVersion != "1" || value.ConsentRequired is null ||
                value.MinimumAuthorisedCollectors is null || value.MinimumAuthorisedCollectors < 0 ||
                value.WorkerRequirements is null || value.ExtensionData is { Count: > 0 }) return null;
            if (value.WorkerRequirements.Any(x => x.ExtensionData is { Count: > 0 } ||
                !SupportedRoleKeys.Contains(x.RoleRequirementKey) || x.Minimum < 0 ||
                (x.MaximumChildrenPerWorker.HasValue && x.MaximumChildrenPerWorker <= 0) ||
                string.IsNullOrWhiteSpace(x.EligibilityEvidenceCode)) ||
                value.WorkerRequirements.GroupBy(x => x.RoleRequirementKey, StringComparer.Ordinal).Any(x => x.Count() > 1) ||
                !value.WorkerRequirements.Any(x => x.RoleRequirementKey == LeadRoleKey && x.Minimum >= 1)) return null;
            return value;
        }
        catch (JsonException) { return null; }
    }

    public static EventSafeguardingReadinessDto Evaluate(
        EventSafeguardingConfiguration? configuration,
        IReadOnlyList<EventChildRegistration> children,
        IReadOnlyList<EventRoleAssignment> roles,
        IReadOnlyList<EventSafeguardingWorkerEligibility> workerEvidence,
        DateTime now)
    {
        var blockers = new List<LocalizedTextDto>();
        var policy = configuration?.PolicyVersion;
        var requirements = policy is { IsPublished: true } && policy.EffectiveFromUtc <= now &&
            (!policy.RetiredUtc.HasValue || policy.RetiredUtc > now)
                ? ParsePolicy(policy.RequirementsJson) : null;
        var currentPolicyLoaded = requirements is not null;
        if (!currentPolicyLoaded)
            blockers.Add(new("Applicable versioned safeguarding policy is not loaded or contains unknown values.", "未載入適用的版本化兒童保護政策，或政策包含未知值。"));

        var guardianshipComplete = currentPolicyLoaded;
        if (requirements is not null)
        {
            var activeChildren = children.Where(x => x.IsActive).ToArray();
            if (activeChildren.Length == 0)
            {
                guardianshipComplete = false;
                blockers.Add(new("No child safeguarding registrations are linked to event enrollments.", "尚無兒童保護登記連結至活動報名。"));
            }
            foreach (var child in activeChildren)
            {
                var confirmed = child.Guardians.Where(x => x.Status == EventGuardianRelationshipStatus.Confirmed).ToArray();
                if (confirmed.Length == 0)
                {
                    guardianshipComplete = false;
                    blockers.Add(new($"Guardian relationship is incomplete for child registration {child.Id}.", $"兒童報名 {child.Id} 的監護關係不完整。"));
                }
                if (requirements.ConsentRequired == true)
                {
                    var hasCurrentConsent = confirmed.Any(guardian => child.ConsentRecords
                        .Where(x => x.PolicyVersionId == policy!.Id && x.GuardianRelationshipId == guardian.Id)
                        .OrderByDescending(x => x.RecordedUtc).FirstOrDefault()?.Decision == EventGuardianConsentDecision.Granted);
                    if (!hasCurrentConsent)
                    {
                        guardianshipComplete = false;
                        blockers.Add(new($"Guardian consent is missing for child registration {child.Id}.", $"兒童報名 {child.Id} 缺少監護人同意。"));
                    }
                }
                var activeCollectors = child.AuthorisedCollectors.Count(x => x.IsActive &&
                    confirmed.Any(g => g.Id == x.AuthorisedByGuardianRelationshipId));
                if (activeCollectors < requirements.MinimumAuthorisedCollectors)
                {
                    guardianshipComplete = false;
                    blockers.Add(new($"Authorised collection information is incomplete for child registration {child.Id}.", $"兒童報名 {child.Id} 的授權接領資料不完整。"));
                }
            }
        }

        var eligibleWorkersSatisfied = currentPolicyLoaded;
        if (!roles.Any(x => x.RoleRequirementKey == LeadRoleKey && x.Status == EventRoleAssignmentStatus.Accepted && x.EndedUtc == null))
        {
            eligibleWorkersSatisfied = false;
            blockers.Add(new("Safeguarding lead is missing.", "缺少兒童保護負責人。"));
        }
        if (requirements is not null)
        {
            foreach (var requirement in requirements.WorkerRequirements!)
            {
                var activeChildren = children.Count(x => x.IsActive);
                var ratioMinimum = requirement.MaximumChildrenPerWorker.HasValue && activeChildren > 0
                    ? (activeChildren + requirement.MaximumChildrenPerWorker.Value - 1) / requirement.MaximumChildrenPerWorker.Value
                    : 0;
                var requiredCount = Math.Max(requirement.Minimum, ratioMinimum);
                var eligible = roles.Where(x => x.RoleRequirementKey == requirement.RoleRequirementKey &&
                        x.Status == EventRoleAssignmentStatus.Accepted && x.EndedUtc == null)
                    .Count(role => workerEvidence.Any(e => e.PolicyVersionId == policy!.Id && e.MemberId == role.MemberId &&
                        e.RoleRequirementKey == requirement.RoleRequirementKey &&
                        e.EligibilityEvidenceCode == requirement.EligibilityEvidenceCode && e.IsEligible));
                if (eligible < requiredCount)
                {
                    eligibleWorkersSatisfied = false;
                    blockers.Add(new($"Required eligible workers are not satisfied for {requirement.RoleRequirementKey}: {eligible}/{requiredCount}.",
                        $"{requirement.RoleRequirementKey} 的必要合資格同工未滿足：{eligible}/{requiredCount}。"));
                }
            }
        }
        return new(currentPolicyLoaded, guardianshipComplete, eligibleWorkersSatisfied, blockers, now);
    }

    private static readonly JsonSerializerOptions Options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = false,
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow
    };
}

public sealed class SafeguardingPolicyRequirements
{
    public string SchemaVersion { get; set; } = string.Empty;
    public bool? ConsentRequired { get; set; }
    public int? MinimumAuthorisedCollectors { get; set; }
    public List<SafeguardingWorkerRequirement>? WorkerRequirements { get; set; }
    [JsonExtensionData] public Dictionary<string, JsonElement>? ExtensionData { get; set; }
}

public sealed class SafeguardingWorkerRequirement
{
    public string RoleRequirementKey { get; set; } = string.Empty;
    public int Minimum { get; set; }
    public int? MaximumChildrenPerWorker { get; set; }
    public string EligibilityEvidenceCode { get; set; } = string.Empty;
    [JsonExtensionData] public Dictionary<string, JsonElement>? ExtensionData { get; set; }
}
