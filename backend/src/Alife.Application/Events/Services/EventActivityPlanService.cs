using System.Text.Json;
using System.Text.Json.Nodes;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Services;

public sealed record PlannedActivity(string Id, string Type, RamText Name, RamText Conditions, Guid? OccurrenceId = null);
public sealed record ActivityPlanData(PlannedActivity[] Activities, int? ParticipantCount = null,
    bool IsOuting = false, bool IsOvernight = false, bool IsHighRisk = false, RamText? WeatherConfirmation = null);
public sealed record ActivityPlanSnapshot(ActivityPlanData Data, string ETag);
public sealed record ActivityPlanView(ActivityPlanData Data, string ETag, bool CanEdit,
    ActivityPlanData? LegacyCandidate, IReadOnlyList<EventPlanReportDto> Reports);
public sealed record SaveActivityPlanRequest(ActivityPlanData Data, string ExpectedETag);

public sealed class EventActivityPlanService(IAlifeDbContext db, IEventPackageInvalidationService invalidation, IEventCacheInvalidationService cache)
{
    public static readonly ActivityPlanData Empty = new([]);
    public static ActivityPlanData Parse(string json) => JsonSerializer.Deserialize<ActivityPlanData>(json, RamEvaluator.Json) ?? Empty;
    public static async Task<ActivityPlanSnapshot?> ReadAsync(IAlifeDbContext db, Guid eventId, CancellationToken ct)
    {
        var row = await db.EventActivityPlans.AsNoTracking().FirstOrDefaultAsync(x => x.EventId == eventId, ct);
        return row is null ? null : new(Parse(row.DataJson), row.ConcurrencyToken.ToString());
    }
    public static string? Validate(ActivityPlanData? data)
    {
        bool Text(RamText? value, int limit, bool required = false) => value is { En: not null, Zh: not null } && value.En.Length <= limit && value.Zh.Length <= limit && (!required || RamEvaluator.HasText(value));
        if (data?.Activities is null || data.Activities.Length > 50 || data.ParticipantCount is < 1 or > 1000000 ||
            data.WeatherConfirmation is not null && !Text(data.WeatherConfirmation, 4000) ||
            data.Activities.Any(a => a is null || string.IsNullOrWhiteSpace(a.Id) || a.Id.Length > 80 || !RamPolicyDefaults.ActivityTypes.Contains(a.Type) || !Text(a.Name, 300, true) || !Text(a.Conditions, 4000)) ||
            data.Activities.Select(a => a.Id).Distinct().Count() != data.Activities.Length)
            return "Invalid activities or conditions. / 活动项目或条件格式无效。";
        return null;
    }
    public static RamV2Draft Mirror(RamV2Draft draft, RamEventPlanContextDto context)
    {
        var plan = context.ActivityPlan?.Data ?? Empty;
        draft.Activities = plan.Activities.Select(a => new RamActivity { Id = a.Id, Type = a.Type, Name = a.Name, Conditions = a.Conditions, OccurrenceId = a.OccurrenceId }).ToArray();
        draft.ParticipantCount = plan.ParticipantCount; draft.IsOuting = plan.IsOuting;
        draft.IsOvernight = plan.IsOvernight; draft.IsHighRisk = plan.IsHighRisk;
        draft.WeatherConfirmation = plan.WeatherConfirmation ?? new();
        var travel = context.Reports.FirstOrDefault(r => r.ModuleCode == "MOVE.STAY")?.Text;
        draft.Transport = travel is null ? new() : new(travel.En, travel.Zh);
        draft.Accommodation = draft.IsOvernight ? draft.Transport : new();
        return draft; // Keep risks/answers, including risks whose source activity was removed.
    }
    public static string MirrorLegacySources(string json, RamEventPlanContextDto context)
    {
        // Keep legacy-only fields and the schema unchanged until explicit upgrade.
        var old = JsonNode.Parse(json)!.AsObject();
        var sources = JsonSerializer.SerializeToNode(Mirror(new(),context),RamEvaluator.Json)!.AsObject();
        foreach (var key in new[] { "activities", "participantCount", "isOuting", "isOvernight", "isHighRisk", "weatherConfirmation", "transport", "accommodation" })
            old[key] = sources[key]?.DeepClone();
        return old.ToJsonString(RamEvaluator.Json);
    }
    public async Task<AppResult<ActivityPlanView>> GetAsync(Guid eventId, Guid actor, CancellationToken ct)
    {
        var e = await db.GroupEvents.AsNoTracking().Include(x => x.RamAssessment).FirstOrDefaultAsync(x => x.Id == eventId, ct);
        if (e is null) return AppResult<ActivityPlanView>.NotFound("Event not found.");
        if (!await EventWorkAccess.PlanReaderAsync(db, e, actor, ct)) return AppResult<ActivityPlanView>.Forbidden("Event plan permission is required.");
        var context = await EventPlanContextCapture.CaptureAsync(db, e, ct);
        ActivityPlanData? legacy = null;
        if (context.ActivityPlan is null && e.RamAssessment?.SchemaVersion == 2)
        {
            var old = RamEvaluator.Parse(e.RamAssessment.RamDataJson);
            legacy = new(old.Activities.Where(a => !a.Id.StartsWith("ai-", StringComparison.Ordinal)).Select(a => new PlannedActivity(a.Id,a.Type,a.Name,a.Conditions ?? new(),a.OccurrenceId)).ToArray(), old.ParticipantCount, old.IsOuting, old.IsOvernight, old.IsHighRisk, old.WeatherConfirmation);
        }
        return AppResult<ActivityPlanView>.Success(new(context.ActivityPlan?.Data ?? Empty, context.ActivityPlan?.ETag ?? "new",
            await EventWorkAccess.OwnerAsync(db,e,actor,ct) && !await EventPreparationPolicy.IsFrozenAsync(db,eventId,ct), legacy, context.Reports));
    }
    public async Task<AppResult<ActivityPlanView>> SaveAsync(Guid eventId, Guid actor, SaveActivityPlanRequest request, CancellationToken ct)
    {
        await using var tx = await db.BeginSerializableTransactionAsync(ct);
        await db.LockEventRegistrationAsync(eventId, ct);
        var e = await db.GroupEvents.FirstOrDefaultAsync(x => x.Id == eventId, ct);
        if (e is null) return AppResult<ActivityPlanView>.NotFound("Event not found.");
        if (!await EventWorkAccess.OwnerAsync(db,e,actor,ct)) return AppResult<ActivityPlanView>.Forbidden("Only the current Event owner may define activities.");
        if (await EventPreparationPolicy.IsFrozenAsync(db,eventId,ct)) return AppResult<ActivityPlanView>.Conflict(EventPreparationPolicy.FrozenMessage);
        if (Validate(request.Data) is { } error) return AppResult<ActivityPlanView>.Validation(error);
        var ids = request.Data.Activities.Where(a => a.OccurrenceId.HasValue).Select(a => a.OccurrenceId!.Value).Distinct().ToArray();
        if (await db.EventOccurrences.CountAsync(o => o.EventId == eventId && ids.Contains(o.Id),ct) != ids.Length) return AppResult<ActivityPlanView>.Validation("The occurrence must belong to this Event.");
        var row = await db.EventActivityPlans.FirstOrDefaultAsync(x => x.EventId == eventId,ct);
        if (request.ExpectedETag != (row?.ConcurrencyToken.ToString() ?? "new")) return AppResult<ActivityPlanView>.PreconditionFailed("Activity plan changed. Reload before saving. / 活动计划已改变，请重新载入。");
        var json = RamEvaluator.Serialize(request.Data);
        if (row?.DataJson == json) return await GetAsync(eventId,actor,ct);
        if (row is null) { row = new() { EventId = eventId }; db.EventActivityPlans.Add(row); }
        e.UpdatedUtc = DateTime.UtcNow;
        row.DataJson = json; row.ConcurrencyToken = Guid.NewGuid(); row.UpdatedUtc = DateTime.UtcNow;
        await invalidation.InvalidateForModuleChangeAsync(e,actor,"TEAM.WORK","event.activities.changed","operational",ct);
        var ram = e.RamAssessment ?? await db.EventRamAssessments.FirstOrDefaultAsync(x=>x.EventId==eventId,ct);
        if (ram is not null)
        {
            var context = await EventPlanContextCapture.CaptureAsync(db,e,ct);
            context = context with { ActivityPlan = new(request.Data,row.ConcurrencyToken.ToString()) };
            ram.RamDataJson = ram.SchemaVersion == 2 ? RamEvaluator.Serialize(Mirror(RamEvaluator.Parse(ram.RamDataJson),context)) : MirrorLegacySources(ram.RamDataJson,context);
        }
        try { await db.SaveChangesAsync(ct); if (tx is not null) await tx.CommitAsync(ct); }
        catch (DbUpdateConcurrencyException) { return AppResult<ActivityPlanView>.PreconditionFailed("Activity plan changed concurrently."); }
        await cache.RemoveGroupEventsAsync(e.GroupId,ct);
        return await GetAsync(eventId,actor,ct);
    }
}
