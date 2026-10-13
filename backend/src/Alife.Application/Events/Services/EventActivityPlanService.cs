using System.Text.Json;
using System.Text.Json.Serialization;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Services;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record PlannedActivityAnswer(
    [property: JsonRequired] string Value,
    [property: JsonRequired] string Source,
    [property: JsonRequired] bool Confirmed);

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record PlannedActivity(
    string Id,
    [property: JsonRequired] string[] Attributes,
    RamText Name,
    RamText Conditions,
    Guid? OccurrenceId = null,
    string? SourcePresetKey = null,
    int? SourceTemplateVersion = null,
    DateTime? StartUtc = null,
    DateTime? EndUtc = null,
    IReadOnlyDictionary<string, PlannedActivityAnswer>? Answers = null,
    bool PresetConfirmed = false,
    bool RepeatForEachOccurrence = false,
    ProjectConfigurationDefaultsDto? DefaultConfiguration = null);
[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record ActivityPlanData(PlannedActivity[] Activities, int? ParticipantCount = null,
    bool IsOuting = false, bool IsOvernight = false, bool IsHighRisk = false, RamText? WeatherConfirmation = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] int? QuestionnaireVersion = null);
public sealed record ActivityPlanSnapshot(ActivityPlanData Data, string ETag);
public sealed record ActivityPlanView(ActivityPlanData Data, string ETag, bool CanEdit,
    IReadOnlyList<EventPlanReportDto> Reports, RamQuestion[]? CheckItems = null,
    IReadOnlyList<EventProjectQuestionDefinitionDto>? QuestionDefinitions = null,
    string RegistrationMode = "none");
public sealed record SaveActivityPlanRequest(ActivityPlanData Data, string ExpectedETag);

public sealed class EventActivityPlanService(IAlifeDbContext db, IEventPackageInvalidationService invalidation, IEventCacheInvalidationService cache)
{
    public static readonly ActivityPlanData Empty = new([], QuestionnaireVersion: 2);
    public static ActivityPlanData Parse(string json)
    {
        var data = JsonSerializer.Deserialize<ActivityPlanData>(json, RamEvaluator.Json)
            ?? throw new JsonException("Activity plan payload is missing.");
        if (data.QuestionnaireVersion != 2)
            throw new JsonException("Activity plan questionnaireVersion must be 2.");
        return data;
    }
    public static async Task<ActivityPlanSnapshot?> ReadAsync(IAlifeDbContext db, Guid eventId, CancellationToken ct)
    {
        var row = await db.EventActivityPlans.AsNoTracking().FirstOrDefaultAsync(x => x.EventId == eventId, ct);
        return row is null ? null : new(Parse(row.DataJson), row.ConcurrencyToken.ToString());
    }
    public static async Task<RamPolicyData?> PublishedPolicyAsync(IAlifeDbContext db, Guid groupId, CancellationToken ct)
    {
        var church = await EventCompositionPersistence.FindChurchRootIdAsync(db, groupId, ct);
        var policy = await db.EventRamPolicyVersions.AsNoTracking().Where(p => p.ChurchId == church && p.IsPublished).OrderByDescending(p => p.Version).FirstOrDefaultAsync(ct);
        return policy is null ? null : JsonSerializer.Deserialize<RamPolicyData>(policy.PolicyJson, RamEvaluator.Json);
    }
    public static string? Validate(ActivityPlanData? data)
    {
        bool Text(RamText? value, int limit, bool required = false) => value is { En: not null, Zh: not null } && value.En.Length <= limit && value.Zh.Length <= limit && (!required || RamEvaluator.HasText(value));
        if (data?.Activities is not null)
            foreach (var activity in data.Activities.Where(activity => activity?.Answers is not null))
                if (EventProjectQuestionCatalog.ValidateAnswers(activity.Answers!.ToDictionary(
                        answer => answer.Key, answer => answer.Value.Value, StringComparer.Ordinal)) is { } answerError)
                    return answerError;
        if (data?.Activities is null || data.Activities.Length > 50 || data.ParticipantCount is < 1 or > 1000000 ||
            data.QuestionnaireVersion != 2 ||
            data.WeatherConfirmation is not null && !Text(data.WeatherConfirmation, 4000) ||
            data.Activities.Any(a => a is null || string.IsNullOrWhiteSpace(a.Id) || a.Id.Length > 80 ||
                !ActivityAttributes.Valid(a.Attributes) ||
                !Text(a.Name, 300, true) || !Text(a.Conditions, 4000) ||
                a.SourcePresetKey is { Length: > 80 } || a.SourceTemplateVersion is < 1 ||
                a.SourcePresetKey is not null && a.SourceTemplateVersion is null ||
                a.RepeatForEachOccurrence && a.OccurrenceId.HasValue ||
                a.StartUtc.HasValue != a.EndUtc.HasValue ||
                a.StartUtc.HasValue && (a.StartUtc.Value.Kind != DateTimeKind.Utc ||
                    a.EndUtc!.Value.Kind != DateTimeKind.Utc || a.EndUtc.Value <= a.StartUtc.Value) ||
                a.Answers?.Any(answer => string.IsNullOrWhiteSpace(answer.Key) ||
                    answer.Value is null ||
                    answer.Value.Value is not ("yes" or "no" or "unknown") ||
                    answer.Value.Source is not ("template" or "human")) == true ||
                !EventProjectQuestionCatalog.ValidDefaultConfiguration(a.DefaultConfiguration)) ||
            data.Activities.Select(a => a.Id).Distinct().Count() != data.Activities.Length)
            return "Invalid activities or conditions. / 活动项目或条件格式无效。";
        if (data.Activities.Any(activity =>
                EventProjectQuestionCatalog.GeneralSwitchCodes.Any(code =>
                    activity.Answers is null || !activity.Answers.TryGetValue(code, out var answer) ||
                    answer.Value is not ("yes" or "no") || !answer.Confirmed)))
            return "Confirm every project arrangement switch before saving. / 保存前须明确每个项目安排开关。";
        return null;
    }
    public static RamV2Draft Mirror(RamV2Draft draft, RamEventPlanContextDto context)
    {
        var plan = context.ActivityPlan?.Data ?? Empty;
        draft.Activities = plan.Activities.Select(a => new RamActivity { Id = a.Id, Attributes = a.Attributes, Name = a.Name, Conditions = a.Conditions, OccurrenceId = a.OccurrenceId }).ToArray();
        draft.ParticipantCount = plan.ParticipantCount; draft.IsOuting = plan.IsOuting;
        draft.IsOvernight = plan.IsOvernight; draft.IsHighRisk = plan.IsHighRisk;
        draft.WeatherConfirmation = plan.WeatherConfirmation ?? new();
        var travel = context.Reports.FirstOrDefault(r => r.ModuleCode == "MOVE.STAY")?.Text;
        draft.Transport = travel is null ? new() : new(travel.En, travel.Zh);
        draft.Accommodation = draft.IsOvernight ? draft.Transport : new();
        return draft; // Keep risks/answers, including risks whose source activity was removed.
    }
    public async Task<AppResult<ActivityPlanView>> GetAsync(Guid eventId, Guid actor, CancellationToken ct)
    {
        var e = await db.GroupEvents.AsNoTracking().Include(x => x.RamAssessment).FirstOrDefaultAsync(x => x.Id == eventId, ct);
        if (e is null) return AppResult<ActivityPlanView>.NotFound("Event not found.");
        if (!await EventWorkAccess.PlanReaderAsync(db, e, actor, ct)) return AppResult<ActivityPlanView>.Forbidden("Event plan permission is required.");
        var context = await EventPlanContextCapture.CaptureAsync(db, e, ct);
        var publishedPolicy = await PublishedPolicyAsync(db, e.GroupId, ct);
        using var eventData = JsonDocument.Parse(e.EventDataJson);
        var registrationMode = eventData.RootElement.TryGetProperty("registrationMode", out var explicitMode) &&
            explicitMode.ValueKind == JsonValueKind.String && explicitMode.GetString() is "none" or "required"
            ? explicitMode.GetString()!
            : eventData.RootElement.TryGetProperty("maxCapacity", out var capacity) &&
                capacity.ValueKind == JsonValueKind.Number && capacity.TryGetInt32(out var count) && count > 0
                ? "required" : "none";
        return AppResult<ActivityPlanView>.Success(new(context.ActivityPlan?.Data ?? Empty, context.ActivityPlan?.ETag ?? "new",
            await EventWorkAccess.OwnerAsync(db,e,actor,ct) && !await EventPreparationPolicy.IsFrozenAsync(db,eventId,ct), context.Reports,
            publishedPolicy?.Questions, EventProjectQuestionCatalog.Definitions, registrationMode));
    }
    public async Task<AppResult<ActivityPlanView>> SaveAsync(Guid eventId, Guid actor, SaveActivityPlanRequest request, CancellationToken ct)
    {
        await using var tx = await db.BeginSerializableTransactionAsync(ct);
        await db.LockEventRegistrationAsync(eventId, ct);
        var e = await db.GroupEvents.FirstOrDefaultAsync(x => x.Id == eventId, ct);
        if (e is null) return AppResult<ActivityPlanView>.NotFound("Event not found.");
        if (!await EventWorkAccess.OwnerAsync(db,e,actor,ct)) return AppResult<ActivityPlanView>.Forbidden("Only the current Event owner may define activities.");
        if (await EventPreparationPolicy.IsFrozenAsync(db,eventId,ct)) return AppResult<ActivityPlanView>.Conflict(EventPreparationPolicy.FrozenMessage);
        var row = await db.EventActivityPlans.FirstOrDefaultAsync(x => x.EventId == eventId,ct);
        var previous = row is null ? null : Parse(row.DataJson);
        if (Validate(request.Data) is { } error) return AppResult<ActivityPlanView>.Validation(error);
        var ids = request.Data.Activities.Where(a => a.OccurrenceId.HasValue).Select(a => a.OccurrenceId!.Value).Distinct().ToArray();
        if (await db.EventOccurrences.CountAsync(o => o.EventId == eventId && ids.Contains(o.Id),ct) != ids.Length) return AppResult<ActivityPlanView>.Validation("The occurrence must belong to this Event.");
        if (request.ExpectedETag != (row?.ConcurrencyToken.ToString() ?? "new")) return AppResult<ActivityPlanView>.PreconditionFailed("Activity plan changed. Reload before saving. / 活动计划已改变，请重新载入。");
        // Registrations and their fee/consent records retain the stable string project ID.
        // Replacing its occurrence binding would silently move an existing participant.
        var changedProjectIds = (previous?.Activities ?? []).Where(old =>
            !request.Data.Activities.Any(current => current.Id == old.Id &&
                current.OccurrenceId == old.OccurrenceId &&
                current.RepeatForEachOccurrence == old.RepeatForEachOccurrence)).Select(a => a.Id).ToArray();
        if (changedProjectIds.Length > 0 && await db.EventActivityParticipations.AsNoTracking().AnyAsync(p =>
                p.Offer.EventId == eventId && changedProjectIds.Contains(p.Offer.ActivityId), ct))
            return AppResult<ActivityPlanView>.Conflict(
                "A project with participation history must remain for audit. Cancel and settle its registrations, then keep this project and create a new one for another occurrence. / 有参加记录的项目须保留供追溯；请先处理取消、通知及退款，若需其他场次请另建项目。");
        if (await EventActivityPlanConsistency.ConflictAsync(db, eventId, request.Data, ct) is { } conflict)
            return AppResult<ActivityPlanView>.Conflict(conflict);
        var json = RamEvaluator.Serialize(request.Data);
        // Attribute order carries no priority and must not invalidate unchanged facts.
        if (row?.DataJson == json || row is not null && previous is not null && ActivityAttributes.FactsJson(previous) == ActivityAttributes.FactsJson(request.Data))
            return await GetAsync(eventId,actor,ct);
        var beforeJson = row?.DataJson;
        if (row is null) { row = new() { EventId = eventId }; db.EventActivityPlans.Add(row); }
        e.UpdatedUtc = DateTime.UtcNow;
        row.DataJson = json; row.ConcurrencyToken = Guid.NewGuid(); row.UpdatedUtc = DateTime.UtcNow;
        db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(), ActorMemberId = actor, Action = "event.activityPlan.save",
            EntityType = "group_event", EntityId = eventId,
            BeforeJson = beforeJson ?? "{}", AfterJson = json,
            MetadataJson = JsonSerializer.Serialize(new { activityCount = request.Data.Activities.Length }),
            OccurredUtc = row.UpdatedUtc
        });
        await invalidation.InvalidateForModuleChangeAsync(e,actor,"TEAM.WORK","event.activities.changed","operational",ct);
        var ram = e.RamAssessment ?? await db.EventRamAssessments.FirstOrDefaultAsync(x=>x.EventId==eventId,ct);
        if (ram is not null)
        {
            var context = await EventPlanContextCapture.CaptureAsync(db,e,ct);
            context = context with { ActivityPlan = new(request.Data,row.ConcurrencyToken.ToString()) };
            ram.RamDataJson = RamEvaluator.Serialize(Mirror(RamEvaluator.Parse(ram.RamDataJson),context));
        }
        try { await db.SaveChangesAsync(ct); if (tx is not null) await tx.CommitAsync(ct); }
        catch (DbUpdateConcurrencyException) { return AppResult<ActivityPlanView>.PreconditionFailed("Activity plan changed concurrently."); }
        await cache.RemoveGroupEventsAsync(e.GroupId,ct);
        return await GetAsync(eventId,actor,ct);
    }
}
