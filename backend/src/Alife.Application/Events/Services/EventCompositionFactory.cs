using System.Text.Json;
using Alife.Domain.Entities;
using Alife.Domain.Enums;

namespace Alife.Application.Events.Services;

public static class EventCompositionFactory
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private static readonly HashSet<string> OptionalModuleKeys = new(
        ["venue", "registration", "finance", "ram", "roster", EventProgrammePolicy.ModuleKey],
        StringComparer.Ordinal);

    public static bool UsesOptionalModule(string eventDataJson, string moduleKey, string? ramDataJson = null)
        => OptionalModuleKeys.Contains(moduleKey) && SelectModules(eventDataJson, ramDataJson).Contains(moduleKey);

    public static IReadOnlyList<string> SelectedOptionalModules(GroupEvent groupEvent)
    {
        var selected = groupEvent.Plan is null
            ? SelectModules(groupEvent.EventDataJson, groupEvent.RamAssessment?.RamDataJson)
            : groupEvent.Plan.Modules.Where(x => x.IsRequired).Select(x => x.ModuleKey).ToHashSet(StringComparer.Ordinal);
        return selected.Where(OptionalModuleKeys.Contains).OrderBy(x => x, StringComparer.Ordinal).ToArray();
    }

    public static EventPlan CreateInitial(
        GroupEvent groupEvent,
        Guid actorMemberId,
        string? ramDataJson,
        DateTime now,
        string changeReason = "Initial composition")
    {
        var plan = new EventPlan
        {
            Id = Guid.NewGuid(), EventId = groupEvent.Id, CurrentRevision = 1,
            Status = EventPlanStatus.Draft, CreatedUtc = now, UpdatedUtc = now
        };
        ApplyStructure(plan, groupEvent, actorMemberId, ramDataJson, now);
        AddRevision(plan, groupEvent.EventDataJson, actorMemberId, changeReason, now);
        return plan;
    }

    public static void Revise(
        EventPlan plan,
        GroupEvent groupEvent,
        Guid actorMemberId,
        string? ramDataJson,
        DateTime now,
        string changeReason = "Event facts updated")
    {
        plan.CurrentRevision += 1;
        plan.UpdatedUtc = now;
        ApplyStructure(plan, groupEvent, actorMemberId, ramDataJson, now);
        AddRevision(plan, groupEvent.EventDataJson, actorMemberId, changeReason, now);
    }

    private static void ApplyStructure(EventPlan plan, GroupEvent groupEvent, Guid actorMemberId, string? ramDataJson, DateTime now)
    {
        var occurrence = plan.Occurrences.FirstOrDefault(x => x.OccurrenceKey == "main");
        if (plan.Occurrences.Count == 0)
        {
            occurrence = new EventOccurrence { Id = Guid.NewGuid(), EventPlanId = plan.Id, OccurrenceKey = "main", SortOrder = 1 };
            plan.Occurrences.Add(occurrence);
        }
        if (plan.Occurrences.Count == 1 && occurrence is not null)
        {
            occurrence.NameEn = groupEvent.TitleEn;
            occurrence.NameZh = groupEvent.TitleZh;
            occurrence.StartUtc = groupEvent.StartDate;
            occurrence.EndUtc = groupEvent.EndDate;
            occurrence.TimeZoneId = ReadString(groupEvent.EventDataJson, "timeZoneId") ?? "UTC";
        }

        var selected = SelectModules(groupEvent.EventDataJson, ramDataJson);
        var closureRequired = groupEvent.EndDate <= now;
        var structuralModules = selected.Append("closure").Append(EventPreparationPlanSync.ModuleKey).ToHashSet(StringComparer.Ordinal);
        foreach (var module in plan.Modules)
        {
            if (module.ModuleKey == EventPreparationPlanSync.ModuleKey) continue;
            module.IsRequired = selected.Contains(module.ModuleKey) || (module.ModuleKey == "closure" && closureRequired);
        }
        foreach (var key in structuralModules)
        {
            var existingModule = plan.Modules.FirstOrDefault(x => x.ModuleKey == key);
            var isRequired = key switch
            {
                "closure" => closureRequired,
                EventPreparationPlanSync.ModuleKey => existingModule?.IsRequired ?? false,
                _ => true
            };
            var module = existingModule;
            if (module is null)
            {
                module = new EventModuleInstance
                {
                    Id = Guid.NewGuid(), EventPlanId = plan.Id, ModuleKey = key, ModuleVersion = 1,
                    IsRequired = isRequired,
                    Status = key == "core" ? EventCorePolicy.ModuleStatus(groupEvent) : EventModuleStatus.NotConfigured,
                    AddedByMemberId = actorMemberId, CreatedUtc = now, UpdatedUtc = now
                };
                plan.Modules.Add(module);
            }
            module.IsRequired = isRequired;

            var gateKey = key == EventPreparationPlanSync.ModuleKey ? "tasks.completed" : $"{key}.configured";
            var gate = plan.ReadinessGates.FirstOrDefault(x => x.GateKey == gateKey);
            if (gate is null)
            {
                var names = ModuleNames(key);
                gate = new EventReadinessGate
                {
                    Id = Guid.NewGuid(), EventPlanId = plan.Id, ModuleInstanceId = module.Id,
                    GateKey = gateKey, NameEn = names.En, NameZh = names.Zh,
                    ExplanationJson = "{}", ModuleInstance = module
                };
                plan.ReadinessGates.Add(gate);
            }
            gate.IsRequired = isRequired;
            gate.Status = module.Status == EventModuleStatus.Ready ? EventReadinessStatus.Satisfied : EventReadinessStatus.Pending;
            gate.UpdatedUtc = now;
        }

        foreach (var gate in plan.ReadinessGates.Where(x => x.ModuleInstance is not null && !structuralModules.Contains(x.ModuleInstance.ModuleKey)))
            gate.IsRequired = false;
    }

    public static void RecordPlanChange(
        EventPlan plan,
        string factsJson,
        Guid actorMemberId,
        string reason,
        DateTime now)
    {
        plan.CurrentRevision += 1;
        plan.UpdatedUtc = now;
        AddRevision(plan, factsJson, actorMemberId, reason, now);
    }

    private static void AddRevision(EventPlan plan, string factsJson, Guid actorMemberId, string reason, DateTime now)
    {
        var composition = new
        {
            schemaVersion = 1,
            modules = plan.Modules.Where(x => x.IsRequired).OrderBy(x => x.ModuleKey).Select(x => new { key = x.ModuleKey, version = x.ModuleVersion }),
            occurrences = plan.Occurrences.OrderBy(x => x.SortOrder).Select(x => x.OccurrenceKey)
        };
        plan.Revisions.Add(new EventPlanRevision
        {
            Id = Guid.NewGuid(), EventPlanId = plan.Id, Revision = plan.CurrentRevision, SchemaVersion = 1,
            FactsJson = factsJson, CompositionJson = JsonSerializer.Serialize(composition, JsonOptions),
            ChangeReason = reason, CreatedByMemberId = actorMemberId, CreatedUtc = now
        });
    }

    private static HashSet<string> SelectModules(string eventDataJson, string? ramDataJson)
    {
        var modules = new HashSet<string>(StringComparer.Ordinal) { "core", "communications" };
        try
        {
            using var document = JsonDocument.Parse(eventDataJson);
            var root = document.RootElement;
            if (root.TryGetProperty("enabledModules", out var enabledModules) && enabledModules.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in enabledModules.EnumerateArray())
                    if (item.ValueKind == JsonValueKind.String && item.GetString() is string key && OptionalModuleKeys.Contains(key))
                        modules.Add(key);
                return modules;
            }
            if (ReadPositiveNumber(root, "maxCapacity") || HasValue(root, "registrationDeadline")) modules.Add("registration");
            if (ReadPositiveNumber(root, "baseFeePerAdult") || ReadPositiveNumber(root, "baseFeePerChild") || HasPositiveFeeOption(root)) modules.Add("finance");
            if (HasNonEmptyArray(root, "hardConstraints")) modules.Add("ram");
            if (ReadTrue(root, "requiresRoster") || HasNonEmptyArray(root, "rosterRoles")) modules.Add("roster");
        }
        catch (JsonException) { }
        if (HasRamWork(ramDataJson)) modules.Add("ram");
        return modules;
    }

    public static bool HasRamWork(string? ramDataJson)
    {
        if (string.IsNullOrWhiteSpace(ramDataJson)) return false;
        try
        {
            using var document = JsonDocument.Parse(ramDataJson);
            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Object) return false;
            return ReadTrue(root, "isOuting")
                || HasNonEmptyArray(root, "hazards")
                || HasNonEmptyArray(root, "emergencyContacts");
        }
        catch (JsonException)
        {
            return false;
        }
    }

    public static bool RequiresRam(string eventDataJson, string? ramDataJson)
    {
        try
        {
            using var document = JsonDocument.Parse(eventDataJson);
            if (document.RootElement.ValueKind == JsonValueKind.Object)
            {
                if (document.RootElement.TryGetProperty("enabledModules", out var enabledModules)
                    && enabledModules.ValueKind == JsonValueKind.Array)
                    return enabledModules.EnumerateArray().Any(x => x.ValueKind == JsonValueKind.String && x.GetString() == "ram");
                if (HasNonEmptyArray(document.RootElement, "hardConstraints")) return true;
            }
        }
        catch (JsonException) { }
        return HasRamWork(ramDataJson);
    }

    private static (string En, string Zh) ModuleNames(string key) => key switch
    {
        "core" => ("Basic information confirmed", "基本资料已确认"),
        "communications" => ("Activity notice ready", "活动通知已确认"),
        "venue" => ("Venue confirmed", "场地已确认"),
        "registration" => ("Registration ready", "报名已准备"),
        "finance" => ("Finance setup confirmed", "费用设置已确认"),
        "ram" => ("Risk assessment approved", "风险评估已批准"),
        "roster" => ("Volunteer roster confirmed", "同工排班已确认"),
        "programme" => ("Programme and handovers confirmed", "程序单与岗位交接已确认"),
        "closure" => ("Closure report confirmed", "活动总结已确认"),
        "tasks" => ("Required preparation tasks completed", "必要筹备任务已完成"),
        _ => ($"{key} ready", $"{key} 已准备")
    };

    private static string? ReadString(string json, string property)
    {
        try { using var doc = JsonDocument.Parse(json); return doc.RootElement.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null; }
        catch (JsonException) { return null; }
    }
    private static bool HasValue(JsonElement root, string name) => root.TryGetProperty(name, out var value) && value.ValueKind is not JsonValueKind.Null and not JsonValueKind.Undefined && value.ToString().Length > 0;
    private static bool HasNonEmptyArray(JsonElement root, string name) => root.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.Array && value.GetArrayLength() > 0;
    private static bool HasPositiveFeeOption(JsonElement root) => root.TryGetProperty("optionalActivities", out var value)
        && value.ValueKind == JsonValueKind.Array
        && value.EnumerateArray().Any(x => x.ValueKind == JsonValueKind.Object && ReadPositiveNumber(x, "extraFee"));
    private static bool ReadPositiveNumber(JsonElement root, string name) => root.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.Number && value.TryGetDecimal(out var number) && number > 0;
    private static bool ReadTrue(JsonElement root, string name) => root.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.True;
}
