using System.Text.Json;
using System.Text.RegularExpressions;
using Alife.Application.Events.Dtos;
using Alife.Domain.Entities;

namespace Alife.Application.Events.Services;

// This projection never sends free text, people, private reports, locations or health data to AI.
// It extracts possible activity signals locally, then asks AI to identify risks for those signals.
public sealed record RamSyncActivity(string Key, string Type);
public sealed record RamSyncContext(string[] Modules, string[] ActivityTypes, bool Overnight,
    bool Outdoor, bool Children, int ProgrammeItems, int VenueCount, RamSyncActivity[]? Activities = null);
public sealed record RamSyncRisk(string ActivityType, string CategoryCode, RamText Hazard,
    RamText Consequence, RamText ControlMeasures, RamText AdditionalAction, string? ActivityKey = null);
public interface IRamSyncAi
{
    Task<IReadOnlyList<RamSyncRisk>> IdentifyAsync(RamSyncContext context, CancellationToken ct);
}

public static class RamSyncPolicy
{
    public const string WaitMessage = "ram.sync.pending: Wait for RAM synchronization, then review the current risks. / 请等待 RAM 同步完成，再核对当前风险。";
    public const string ReviewMessage = "ram.sync.reviewRequired: Review the latest RAM before submitting the Event. / 请核对最新 RAM 后再提交活动。";

    public static void Schedule(EventRamAssessment ram, DateTime now)
    {
        ram.IsUpdated = false; ram.SyncStatus = "Outdated";
        ram.SyncDueUtc = now.AddSeconds(15); ram.SyncAttempts = 0; ram.SyncError = null;
        ram.SyncReviewedByMemberId = null; ram.SyncReviewedAt = null;
        ram.ConcurrencyToken = Guid.NewGuid();
    }

    public static RamSyncContext Project(RamEventPlanContextDto context)
    {
        var modules = context.AcceptedPlan?.Plan.ModuleDecisions
            .Where(m => m.Status is Alife.Domain.Enums.EventModuleDecisionStatus.Selected or Alife.Domain.Enums.EventModuleDecisionStatus.Required)
            .Select(m => m.ModuleCode).Order().ToArray() ?? [];
        // Keep Chinese characters readable for local matching; this text never leaves the origin.
        var text = JsonSerializer.Serialize(new { context.Title, context.Details, context.Reports, context.Programme, Plan = context.ActivityPlan?.Data },
            new JsonSerializerOptions { Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping });
        var types = new List<string>();
        foreach (var (type, pattern) in new[] {
            ("water", "kayak|canoe|swim|boat|surf|beach|river|water sport|皮划艇|独木舟|游泳|划船|海滩|水上|河流"),
            ("hiking", "hik(e|ing)|tramp|mountain|trail|徒步|登山|步道"),
            ("sport", "sport|football|basketball|运动|足球|篮球"),
            ("camp", "overnight|accommodation|camp|lodging|住宿|露营|过夜"),
            ("transport", "transport|bus|driv|交通|接送|巴士|驾驶"),
            ("meal", "food|meal|cook|餐|饮食|烹饪") })
            if (Regex.IsMatch(text, pattern, RegexOptions.IgnoreCase)) types.Add(type);
        if (modules.Contains("MOVE.STAY") && !types.Contains("transport")) types.Add("transport");
        if (modules.Contains("FOOD.HOSPITALITY") && !types.Contains("meal")) types.Add("meal");
        if (types.Count == 0) types.Add("generic");
        var plan = context.ActivityPlan?.Data;
        var activities = plan?.Activities.Select((a,i) => new RamSyncActivity("a" + i, a.Type)).ToArray() ?? [];
        return new(modules, types.Concat(activities.Select(a => a.Type)).Distinct().ToArray(), plan?.IsOvernight == true || types.Contains("camp"), plan?.IsOuting == true || types.Contains("water") || types.Contains("hiking"),
            modules.Contains("SAFEGUARDING.CHILD"), context.Programme.Sum(p => p.Items.Count), context.Venues.Count + context.WeeklyVenues.Count, activities);
    }

    public static RamV2Draft Merge(RamV2Draft draft, IReadOnlyList<RamSyncRisk> risks, string previousJson, out string generatedJson)
    {
        if (risks.Count is < 1 or > 20) throw new InvalidDataException("Invalid risk count.");
        var previous = JsonSerializer.Deserialize<RamRisk[]>(previousJson, RamEvaluator.Json) ?? [];
        // Only replace untouched AI rows. Human overrides and all manual risks survive every sync.
        var kept = draft.Hazards.Where(r => !draft.Activities.Any(a => a.Id == r.ActivityId) ||
            !previous.Any(p => p.Id == r.Id && RamEvaluator.Serialize(p) == RamEvaluator.Serialize(r))).ToList();
        var generated = new List<RamRisk>();
        foreach (var risk in risks)
        {
            if (!new[] { "generic", "hiking", "water", "sport", "transport", "camp", "meal", "outdoor", "other" }.Contains(risk.ActivityType) ||
                !new[] { "environment", "activity", "participants", "transport", "emergency" }.Contains(risk.CategoryCode) ||
                new[] { risk.Hazard, risk.Consequence, risk.ControlMeasures, risk.AdditionalAction }.Any(t => t is null || string.IsNullOrWhiteSpace(t.En) || string.IsNullOrWhiteSpace(t.Zh) || t.En.Length > 2000 || t.Zh.Length > 2000))
                throw new InvalidDataException("Invalid bilingual risk.");
            var source = draft.Activities.Select((a,i) => new { Activity = a, Key = "a" + i }).SingleOrDefault(a => a.Key == risk.ActivityKey);
            if (source is null) throw new InvalidDataException("Unknown source activity.");
            var activityId = source.Activity.Id;
            if (kept.Any(r => r.ActivityId == activityId && r.CategoryCode == risk.CategoryCode && r.Hazard == risk.Hazard)) continue;
            generated.Add(new() { Id = "ai-" + Guid.NewGuid().ToString("N"), ActivityId = activityId, CategoryCode = risk.CategoryCode,
                Hazard = risk.Hazard, Consequence = risk.Consequence, ControlMeasures = risk.ControlMeasures, AdditionalAction = risk.AdditionalAction });
        }
        if (kept.Count + generated.Count > 100) throw new InvalidDataException("Review and reduce the risk list before retrying.");
        draft.Hazards = kept.Concat(generated).ToArray();
        // AI never supplies likelihood, impact, completed controls, answers, identities or signatures.
        generatedJson = RamEvaluator.Serialize(generated);
        return draft;
    }
}
