using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Domain.Enums;

namespace Alife.Application.Events.Services;

public sealed record EventCompositionContext(
    string BaselineETag,
    IReadOnlyList<ModuleDecisionDto>? BaseModuleDecisions = null,
    IReadOnlySet<string>? ProtectedModuleCodes = null,
    IReadOnlySet<string>? SatisfiedReadinessRules = null,
    bool HasAccountableOwner = true,
    EventGovernanceMode GovernanceMode = EventGovernanceMode.MemberLed,
    EventSponsorshipStatus SponsorshipStatus = EventSponsorshipStatus.NotRequested,
    DateTime? CheckedUtc = null,
    EventWorkflowRecommendationDto? WorkflowRecommendation = null,
    IReadOnlyDictionary<string, EventActivityTypeDefinition>? ActivityTypesByCode = null);

public interface IEventCompositionEngine
{
    AppResult<EventPlanProposalDto> Compose(EventPlanComposeRequest request, EventCompositionContext context);
}

public sealed class EventCompositionEngine : IEventCompositionEngine
{
    private static readonly JsonSerializerOptions JsonOptions = CreateJsonOptions();
    private static readonly IReadOnlySet<string> KnownFactCodes = EventCompositionDefinitions.Modules
        .SelectMany(module => module.ActivationRules)
        .Select(rule => rule.FactCode)
        .Append("event.exists")
        .ToHashSet(StringComparer.Ordinal);

    public AppResult<EventPlanProposalDto> Compose(EventPlanComposeRequest request, EventCompositionContext context)
    {
        var activityTypesByCode = context.ActivityTypesByCode ?? EventCompositionDefinitions.ActivityTypesByCode;
        var validation = Validate(request, activityTypesByCode);
        if (validation is not null)
        {
            return AppResult<EventPlanProposalDto>.Validation(validation);
        }

        var archetype = string.IsNullOrWhiteSpace(request.ArchetypeCode)
            ? null
            : EventCompositionDefinitions.ArchetypesByCode[request.ArchetypeCode];
        var activityType = string.IsNullOrWhiteSpace(request.ActivityTypeCode)
            ? null
            : activityTypesByCode[request.ActivityTypeCode];
        var facts = NormalizeFacts(request.Facts.Items);
        var confirmedFacts = facts
            .Where(x => x.Certainty == EventFactCertainty.Confirmed)
            .ToDictionary(x => x.Code, StringComparer.Ordinal);
        var selections = (request.HumanSelections ?? [])
            .ToDictionary(x => x.ModuleCode, StringComparer.Ordinal);
        var explicitDeselections = selections
            .Where(x => !x.Value.Selected)
            .Select(x => x.Key)
            .ToHashSet(StringComparer.Ordinal);

        var states = EventCompositionDefinitions.Modules.ToDictionary(
            x => x.Code,
            x => new DecisionState(EventModuleDecisionStatus.Inactive),
            StringComparer.Ordinal);

        // Confirmed facts are authoritative. Candidate and unknown values never
        // match activation or deactivation conditions.
        foreach (var module in EventCompositionDefinitions.Modules)
        {
            foreach (var rule in module.ActivationRules.Where(x => x.Decision == EventModuleDecisionStatus.Required))
            {
                if (Matches(rule, confirmedFacts))
                {
                    Promote(states[module.Code], EventModuleDecisionStatus.Required, rule.ReasonCode);
                }
            }
        }

        // Policy invariant: every event has one accountable owner and therefore
        // always uses TEAM.WORK. No client or archetype can turn it off.
        Promote(states["TEAM.WORK"], EventModuleDecisionStatus.Required, "policy-accountable-owner");

        foreach (var selection in selections.Values.Where(x => x.Selected))
        {
            Promote(states[selection.ModuleCode], EventModuleDecisionStatus.Selected,
                string.IsNullOrWhiteSpace(selection.Reason) ? "human-selected" : "human-selected-with-reason");
        }

        if (activityType is not null)
        {
            foreach (var code in activityType.PreselectedModules.Where(code => !explicitDeselections.Contains(code)))
            {
                Promote(states[code], EventModuleDecisionStatus.Selected,
                    $"activity-type:{activityType.Code}:preselected");
            }
        }

        // The 1.0 contract used module defaults directly from an archetype. The
        // 1.1 contract moves those defaults to the more precise activity type;
        // archetypes continue to describe structure only.
        if (archetype is not null &&
            string.Equals(request.SchemaVersion, EventCompositionDefinitions.LegacySchemaVersion, StringComparison.Ordinal))
        {
            foreach (var code in archetype.RequiredModules.Where(code => !explicitDeselections.Contains(code)))
            {
                Promote(states[code], EventModuleDecisionStatus.Selected, $"archetype:{archetype.Code}:required-default");
            }
            foreach (var code in archetype.RecommendedModules.Where(code => !explicitDeselections.Contains(code)))
            {
                Promote(states[code], EventModuleDecisionStatus.Recommended, $"archetype:{archetype.Code}:recommended-default");
            }
        }

        foreach (var module in EventCompositionDefinitions.Modules.Where(x => !explicitDeselections.Contains(x.Code)))
        {
            foreach (var rule in module.ActivationRules.Where(x => x.Decision == EventModuleDecisionStatus.Recommended))
            {
                if (Matches(rule, confirmedFacts))
                {
                    Promote(states[module.Code], EventModuleDecisionStatus.Recommended, rule.ReasonCode);
                }
            }
        }

        CloseDependencies(states);

        var decisions = EventCompositionDefinitions.Modules
            .OrderBy(x => x.NavigationOrder)
            .Select(module => new ModuleDecisionDto(
                module.Code,
                module.Version,
                module.Name,
                states[module.Code].Status,
                states[module.Code].Reasons.OrderBy(x => x, StringComparer.Ordinal).ToArray(),
                module.Dependencies,
                module.DataClasses,
                module.IntegrationKey,
                module.SurfaceKey,
                module.NavigationOrder))
            .ToArray();

        var activeModules = decisions
            .Where(IsActive)
            .Select(x => EventCompositionDefinitions.ModulesByCode[x.ModuleCode])
            .ToArray();
        var roles = activeModules
            .SelectMany(module => module.RoleRequirements.Select(role => new RoleRequirementDto(
                $"{module.Code}:{role.RoleCode}", module.Code, role.RoleCode,
                role.Minimum, role.Recommended, role.Maximum, role.Eligibility, role.SeparationFrom)))
            .OrderBy(x => x.RequirementKey, StringComparer.Ordinal)
            .ToArray();
        var workflow = activeModules
            .SelectMany(module => module.WorkflowContributions.Select(step =>
                new WorkflowContributionDto(module.Code, step, module.IntegrationKey)))
            .OrderBy(x => x.ModuleCode, StringComparer.Ordinal)
            .ThenBy(x => x.StepKey, StringComparer.Ordinal)
            .ToArray();

        var satisfiedRules = context.SatisfiedReadinessRules ?? new HashSet<string>(StringComparer.Ordinal);
        var moduleBlockers = BuildModuleBlockers(decisions, satisfiedRules, context.HasAccountableOwner);
        var blockers = moduleBlockers.Values.SelectMany(x => x).ToList();
        if (context.GovernanceMode == EventGovernanceMode.ChurchSponsored &&
            context.SponsorshipStatus != EventSponsorshipStatus.Approved)
        {
            blockers.Add(Text(
                "Root-church sponsorship must be approved before public publication.",
                "公開發布前必須取得根教會 sponsorship 批准。"));
        }

        var workflowRecommendation = BuildWorkflowRecommendation(request, activityType, context.WorkflowRecommendation);
        var warnings = BuildWarnings(facts, explicitDeselections, states, workflowRecommendation);
        var readiness = new ReadinessDto(
            blockers.Count > 0 ? EventReadinessStatus.Blocked : EventReadinessStatus.Ready,
            blockers,
            warnings,
            context.CheckedUtc ?? DateTime.UtcNow);
        var navigation = BuildNavigation(decisions, moduleBlockers, readiness.Status);
        var diff = BuildDiff(decisions, context.BaseModuleDecisions, context.ProtectedModuleCodes);
        var factSet = new EventFactSetDto(null, facts, Hash(facts));

        var proposal = new EventPlanProposalDto(
            request.SchemaVersion,
            string.Empty,
            context.BaselineETag,
            request.BasePlanVersion,
            archetype?.Code,
            archetype?.Version,
            factSet,
            decisions,
            roles,
            workflow,
            readiness,
            navigation,
            diff,
            warnings,
            activityType?.Code,
            activityType?.Version,
            workflowRecommendation);

        return AppResult<EventPlanProposalDto>.Success(proposal with
        {
            ProposalHash = Hash(new
            {
                proposal.SchemaVersion,
                proposal.BaselineETag,
                proposal.BasePlanVersion,
                proposal.ArchetypeCode,
                proposal.ArchetypeVersion,
                proposal.ActivityTypeCode,
                proposal.ActivityTypeVersion,
                proposal.WorkflowRecommendation,
                proposal.Facts,
                proposal.ModuleDecisions,
                proposal.RoleRequirements,
                proposal.WorkflowContributions,
                readiness = new { proposal.Readiness.Status, proposal.Readiness.Blockers, proposal.Readiness.Warnings },
                proposal.Navigation,
                proposal.Diff,
                proposal.Warnings
            })
        });
    }

    private static string? Validate(
        EventPlanComposeRequest request,
        IReadOnlyDictionary<string, EventActivityTypeDefinition> activityTypesByCode)
    {
        var isCurrent = string.Equals(
            request.SchemaVersion, EventCompositionDefinitions.SchemaVersion, StringComparison.Ordinal);
        var isLegacy = string.Equals(
            request.SchemaVersion, EventCompositionDefinitions.LegacySchemaVersion, StringComparison.Ordinal);
        if (!isCurrent && !isLegacy)
        {
            return $"schemaVersion must be {EventCompositionDefinitions.SchemaVersion} or {EventCompositionDefinitions.LegacySchemaVersion}.";
        }
        if (request.Facts?.Items is null)
        {
            return "facts.items is required.";
        }
        if (!string.IsNullOrWhiteSpace(request.ArchetypeCode) &&
            !EventCompositionDefinitions.ArchetypesByCode.ContainsKey(request.ArchetypeCode))
        {
            return "Unknown archetypeCode.";
        }
        if (isCurrent && string.IsNullOrWhiteSpace(request.ArchetypeCode))
        {
            return "archetypeCode is required in schemaVersion 1.1.0.";
        }
        if (isCurrent && string.IsNullOrWhiteSpace(request.ActivityTypeCode))
        {
            return "activityTypeCode is required in schemaVersion 1.1.0.";
        }
        EventActivityTypeDefinition? activityType = null;
        if (!string.IsNullOrWhiteSpace(request.ActivityTypeCode) &&
            !activityTypesByCode.TryGetValue(request.ActivityTypeCode, out activityType))
        {
            return "Unknown activityTypeCode.";
        }
        if (activityType is not null &&
            !string.Equals(activityType.ArchetypeCode, request.ArchetypeCode, StringComparison.Ordinal))
        {
            return "activityTypeCode does not belong to archetypeCode.";
        }
        if (isLegacy && !string.IsNullOrWhiteSpace(request.ActivityTypeCode))
        {
            return "activityTypeCode is not supported in schemaVersion 1.0.0.";
        }

        var duplicateFact = request.Facts.Items
            .Where(x => !string.IsNullOrWhiteSpace(x.Code))
            .GroupBy(x => x.Code, StringComparer.Ordinal)
            .FirstOrDefault(x => x.Count() > 1);
        if (duplicateFact is not null)
        {
            return $"Fact code must be unique: {duplicateFact.Key}.";
        }
        if (request.Facts.Items.Any(x => string.IsNullOrWhiteSpace(x.Code)))
        {
            return "Fact code is required.";
        }
        if (request.Facts.Items.Any(x => string.Equals(x.Code, "event.exists", StringComparison.Ordinal)))
        {
            return "event.exists is a server-controlled fact.";
        }
        var unknownFact = request.Facts.Items.FirstOrDefault(x => !KnownFactCodes.Contains(x.Code));
        if (unknownFact is not null)
        {
            return $"Unknown fact code: {unknownFact.Code}.";
        }
        if (request.Facts.Items.Any(x => x.Source is EventFactSource.TrustedContext or EventFactSource.LegacyBackfill))
        {
            return "trustedContext and legacyBackfill fact sources are server-controlled.";
        }
        if (request.Facts.Items.Any(x => x.Source == EventFactSource.AiCandidate &&
            x.Certainty == EventFactCertainty.Confirmed))
        {
            return "AI candidate facts cannot be confirmed.";
        }
        if (request.Facts.Items.Any(x => x.Certainty == EventFactCertainty.Confirmed && x.Value is null))
        {
            return "Confirmed facts require a value.";
        }
        if (request.Facts.Items.Any(x => x.Value is { } value &&
            value.ValueKind is not JsonValueKind.String and
            not JsonValueKind.True and not JsonValueKind.False and not JsonValueKind.Null))
        {
            return "Fact values must be a string, boolean or null.";
        }
        if (request.Facts.Items.Any(x => x.Value is { } value &&
            value.ValueKind == JsonValueKind.String && value.GetString()?.Length > 200))
        {
            return "Fact string values must be 200 characters or fewer.";
        }

        var selections = request.HumanSelections ?? [];
        var unknownSelection = selections.FirstOrDefault(x =>
            !EventCompositionDefinitions.ModulesByCode.ContainsKey(x.ModuleCode));
        if (unknownSelection is not null)
        {
            return $"Unknown moduleCode: {unknownSelection.ModuleCode}.";
        }
        var duplicateSelection = selections
            .GroupBy(x => x.ModuleCode, StringComparer.Ordinal)
            .FirstOrDefault(x => x.Count() > 1);
        return duplicateSelection is null
            ? null
            : $"Module selection must be unique: {duplicateSelection.Key}.";
    }

    private static IReadOnlyList<EventFactInputDto> NormalizeFacts(IReadOnlyList<EventFactInputDto> source)
    {
        var facts = source
            .Where(x => !string.Equals(x.Code, "event.exists", StringComparison.Ordinal))
            .OrderBy(x => x.Code, StringComparer.Ordinal)
            .ToList();
        facts.Insert(0, new EventFactInputDto(
            "event.exists",
            JsonSerializer.SerializeToElement(true),
            EventFactCertainty.Confirmed,
            EventFactSource.TrustedContext));
        return facts;
    }

    private static bool Matches(
        EventModuleActivationRule rule,
        IReadOnlyDictionary<string, EventFactInputDto> confirmedFacts)
    {
        if (!confirmedFacts.TryGetValue(rule.FactCode, out var fact) || fact.Value is null)
        {
            return false;
        }

        var equal = rule.ExpectedValue switch
        {
            bool expected when fact.Value.Value.ValueKind is JsonValueKind.True or JsonValueKind.False =>
                fact.Value.Value.GetBoolean() == expected,
            string expected when fact.Value.Value.ValueKind == JsonValueKind.String =>
                string.Equals(fact.Value.Value.GetString(), expected, StringComparison.Ordinal),
            _ => false
        };
        return rule.Operator == "neq" ? !equal : equal;
    }

    private static void CloseDependencies(IReadOnlyDictionary<string, DecisionState> states)
    {
        var changed = true;
        while (changed)
        {
            changed = false;
            foreach (var module in EventCompositionDefinitions.Modules)
            {
                var state = states[module.Code];
                if (state.Status == EventModuleDecisionStatus.Inactive)
                {
                    continue;
                }

                foreach (var dependency in module.Dependencies)
                {
                    var before = states[dependency].Status;
                    var dependencyStatus = state.Status == EventModuleDecisionStatus.Recommended
                        ? EventModuleDecisionStatus.Recommended
                        : EventModuleDecisionStatus.Required;
                    Promote(states[dependency], dependencyStatus, $"dependency:{module.Code}");
                    changed |= before != states[dependency].Status;
                }
            }
        }
    }

    private static Dictionary<string, IReadOnlyList<LocalizedTextDto>> BuildModuleBlockers(
        IReadOnlyList<ModuleDecisionDto> decisions,
        IReadOnlySet<string> satisfiedRules,
        bool hasAccountableOwner)
    {
        var result = new Dictionary<string, IReadOnlyList<LocalizedTextDto>>(StringComparer.Ordinal);
        foreach (var decision in decisions.Where(x => x.Status == EventModuleDecisionStatus.Required))
        {
            var module = EventCompositionDefinitions.ModulesByCode[decision.ModuleCode];
            var blockers = new List<LocalizedTextDto>();
            foreach (var rule in module.ReadinessRules)
            {
                var satisfied = rule == "accountable-owner-assigned"
                    ? hasAccountableOwner
                    : satisfiedRules.Contains(rule);
                if (!satisfied)
                {
                    blockers.Add(Text(
                        $"{module.Name.En}: complete {rule}.",
                        $"{module.Name.Zh}：完成 {rule}。"));
                }
            }
            result[module.Code] = blockers;
        }
        return result;
    }

    private static IReadOnlyList<LocalizedTextDto> BuildWarnings(
        IReadOnlyList<EventFactInputDto> facts,
        IReadOnlySet<string> explicitDeselections,
        IReadOnlyDictionary<string, DecisionState> states,
        EventWorkflowRecommendationDto? workflowRecommendation)
    {
        var warnings = new List<LocalizedTextDto>();
        if (facts.Any(x => x.Certainty == EventFactCertainty.Candidate))
        {
            warnings.Add(Text(
                "Candidate facts are shown for review and did not satisfy policy conditions.",
                "候選事實僅供人工檢視，未用來滿足政策條件。"));
        }
        foreach (var code in explicitDeselections.Where(code => states[code].Status == EventModuleDecisionStatus.Required))
        {
            warnings.Add(Text(
                $"{code} remains required because a confirmed fact or policy overrides the manual deselection.",
                $"{code} 因已確認事實或政策仍為必需，人工取消未生效。"));
        }
        if (workflowRecommendation?.Status == "unavailable")
        {
            warnings.Add(Text(
                $"The recommended {workflowRecommendation.Code} workflow is unavailable. The event can be created without a workflow.",
                $"建議的 {workflowRecommendation.Code} 工作流目前不可用；活動仍可在沒有工作流的情況下建立。"));
        }
        return warnings;
    }

    private static EventWorkflowRecommendationDto? BuildWorkflowRecommendation(
        EventPlanComposeRequest request,
        EventActivityTypeDefinition? activityType,
        EventWorkflowRecommendationDto? resolved)
    {
        if (activityType?.RecommendedWorkflowTemplateCode is not { Length: > 0 } code)
        {
            return null;
        }
        if (resolved is not null)
        {
            return resolved;
        }
        return new EventWorkflowRecommendationDto(
            code,
            null,
            null,
            request.UseRecommendedWorkflow ? "unavailable" : "declined");
    }

    private static IReadOnlyList<EventWorkspaceItemDto> BuildNavigation(
        IReadOnlyList<ModuleDecisionDto> decisions,
        IReadOnlyDictionary<string, IReadOnlyList<LocalizedTextDto>> moduleBlockers,
        EventReadinessStatus overallReadiness)
    {
        var items = new List<EventWorkspaceItemDto>
        {
            new(
                "workspace.overview", null, "tab", "overview", null,
                Text("Overview", "總覽"), 10, overallReadiness, [], [])
        };

        foreach (var decision in decisions.Where(IsActive))
        {
            var surface = EventCompositionDefinitions.SurfacesByKey[decision.SurfaceKey];
            var blockers = moduleBlockers.GetValueOrDefault(decision.ModuleCode) ?? [];
            items.Add(new EventWorkspaceItemDto(
                surface.SurfaceKey,
                decision.ModuleCode,
                surface.Presentation,
                surface.SectionKey,
                surface.PathSegment,
                surface.Label,
                surface.Order,
                blockers.Count > 0 ? EventReadinessStatus.Blocked : EventReadinessStatus.Ready,
                blockers,
                []));
        }
        return items.OrderBy(x => x.Order).ToArray();
    }

    private static EventPlanDiffDto BuildDiff(
        IReadOnlyList<ModuleDecisionDto> decisions,
        IReadOnlyList<ModuleDecisionDto>? baseDecisions,
        IReadOnlySet<string>? protectedCodes)
    {
        var current = decisions.Where(IsActive).ToDictionary(x => x.ModuleCode, StringComparer.Ordinal);
        var previous = (baseDecisions ?? [])
            .Where(IsActive)
            .ToDictionary(x => x.ModuleCode, StringComparer.Ordinal);
        var added = current.Keys.Except(previous.Keys, StringComparer.Ordinal).OrderBy(x => x, StringComparer.Ordinal).ToArray();
        var removed = previous.Keys.Except(current.Keys, StringComparer.Ordinal).OrderBy(x => x, StringComparer.Ordinal).ToArray();
        var changed = current.Keys.Intersect(previous.Keys, StringComparer.Ordinal)
            .Where(code => current[code].Status != previous[code].Status)
            .OrderBy(x => x, StringComparer.Ordinal)
            .ToArray();
        var blocking = removed
            .Where(code => protectedCodes?.Contains(code) == true)
            .ToArray();
        return new EventPlanDiffDto(added, removed, changed, blocking);
    }

    private static bool IsActive(ModuleDecisionDto decision)
        => decision.Status is not EventModuleDecisionStatus.Inactive and not EventModuleDecisionStatus.ExceptionApproved;

    private static void Promote(DecisionState state, EventModuleDecisionStatus next, string reason)
    {
        if (Strength(next) > Strength(state.Status))
        {
            state.Status = next;
        }
        state.Reasons.Add(reason);
    }

    private static int Strength(EventModuleDecisionStatus status) => status switch
    {
        EventModuleDecisionStatus.Required => 3,
        EventModuleDecisionStatus.Selected => 2,
        EventModuleDecisionStatus.Recommended => 1,
        _ => 0
    };

    public static string Hash(object value)
    {
        var bytes = JsonSerializer.SerializeToUtf8Bytes(value, JsonOptions);
        return Convert.ToHexStringLower(SHA256.HashData(bytes));
    }

    public static JsonSerializerOptions CreateJsonOptions()
    {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        options.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase, allowIntegerValues: false));
        return options;
    }

    private static LocalizedTextDto Text(string en, string zh) => new(en, zh);

    private sealed class DecisionState(EventModuleDecisionStatus status)
    {
        public EventModuleDecisionStatus Status { get; set; } = status;
        public HashSet<string> Reasons { get; } = new(StringComparer.Ordinal);
    }
}
