using System.Text.Json;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Services;

/// <summary>Project-linked arrangements; module ownership and report approval remain Event-wide.</summary>
public sealed class EventActivityModuleConfigurationService(IAlifeDbContext db,
    IEventPackageInvalidationService invalidation, IEventCacheInvalidationService cache)
{
    private static readonly IReadOnlyDictionary<string, (string Module, string Role, string Question)> Kinds =
        new Dictionary<string, (string, string, string)>(StringComparer.Ordinal)
        {
            ["meal"] = ("FOOD.HOSPITALITY", "hospitality.lead", "foodService"),
            ["travel"] = ("MOVE.STAY", "travel.coordinator", "organizedTransport"),
            ["stay"] = ("MOVE.STAY", "travel.coordinator", "organizedStay"),
            ["programme"] = ("PROGRAM.PRODUCTION", "programme.lead", "programmeProduction"),
            ["roster"] = ("SERVICE.ROSTER", "roster.coordinator", "serviceTeam")
        };
    public const string NewETag = "\"project-config-new\"";
    private static string ETag(Guid token) => $"\"project-config-{token:N}\"";

    public async Task<AppResult<ProjectModuleConfigurationWorkspaceDto>> GetAsync(Guid eventId, Guid actor, CancellationToken ct)
    {
        var e = await db.GroupEvents.AsNoTracking().FirstOrDefaultAsync(x => x.Id == eventId, ct);
        if (e is null) return AppResult<ProjectModuleConfigurationWorkspaceDto>.NotFound("Event not found.");
        if (!await EventWorkAccess.PlanReaderAsync(db, e, actor, ct))
            return AppResult<ProjectModuleConfigurationWorkspaceDto>.Forbidden("Event plan access is required.");
        var rows = await db.EventActivityModuleConfigurations.AsNoTracking().Where(x => x.EventId == eventId)
            .OrderBy(x => x.ActivityId).ThenBy(x => x.OccurrenceId).ThenBy(x => x.Kind).ToArrayAsync(ct);
        var owner = await EventWorkAccess.OwnerAsync(db, e, actor, ct);
        var editable = new List<string>();
        if (!await EventPreparationPolicy.IsFrozenAsync(db, eventId, ct))
            foreach (var kind in Kinds)
                if (owner || await EventWorkAccess.RoleAsync(db, e, actor, kind.Value.Module, kind.Value.Role, ct))
                    editable.Add(kind.Key);
        return AppResult<ProjectModuleConfigurationWorkspaceDto>.Success(new(rows.Select(ToDto).ToArray(), editable));
    }

    public async Task<AppResult<ProjectModuleConfigurationDto>> SaveAsync(Guid eventId, string activityId, string kind,
        Guid actor, SaveProjectModuleConfigurationRequest request, string expectedETag, CancellationToken ct)
    {
        if (!Kinds.TryGetValue(kind, out var rule)) return AppResult<ProjectModuleConfigurationDto>.NotFound("Project arrangement kind not found.");
        if (request is null || !ValidShape(kind, request))
            return AppResult<ProjectModuleConfigurationDto>.Validation("Provide one valid structured arrangement for this module.");
        await using var tx = await db.BeginSerializableTransactionAsync(ct);
        await db.LockEventRegistrationAsync(eventId, ct);
        var e = await db.GroupEvents.FirstOrDefaultAsync(x => x.Id == eventId, ct);
        if (e is null) return AppResult<ProjectModuleConfigurationDto>.NotFound("Event not found.");
        if (!await EventWorkAccess.OwnerAsync(db, e, actor, ct) &&
            !await EventWorkAccess.RoleAsync(db, e, actor, rule.Module, rule.Role, ct))
            return AppResult<ProjectModuleConfigurationDto>.Forbidden("Current module responsibility is required.");
        if (await EventPreparationPolicy.IsFrozenAsync(db, eventId, ct))
            return AppResult<ProjectModuleConfigurationDto>.Conflict(EventPreparationPolicy.FrozenMessage);
        var plan = await EventActivityPlanService.ReadAsync(db, eventId, ct);
        var activity = plan?.Data.Activities.FirstOrDefault(a => a.Id == activityId);
        if (activity is null || activity.Answers is null ||
            !activity.Answers.TryGetValue(rule.Question, out var answer) || answer is not { Value: "yes" } ||
            plan!.Data.QuestionnaireVersion == 2 && !answer.Confirmed ||
            !EventProjectQuestionCatalog.ApplicableQuestions(activity.Attributes).Any(q => q.Code == rule.Question))
            return AppResult<ProjectModuleConfigurationDto>.Conflict("Confirm the project's applicable module question before configuring it.");
        if (request.OccurrenceId is { } occurrenceId &&
            (activity.OccurrenceId.HasValue && activity.OccurrenceId != occurrenceId ||
             !await db.EventOccurrences.AsNoTracking().AnyAsync(o => o.Id == occurrenceId && o.EventId == eventId, ct)))
            return AppResult<ProjectModuleConfigurationDto>.Validation("The occurrence must belong to this project and Event.");
        if (!await ReferencesBelongToEvent(eventId, kind, request, ct))
            return AppResult<ProjectModuleConfigurationDto>.Validation("A referenced programme, journey or service slot is not in this Event.");
        var row = await db.EventActivityModuleConfigurations.FirstOrDefaultAsync(x => x.EventId == eventId &&
            x.ActivityId == activityId && x.OccurrenceId == request.OccurrenceId && x.Kind == kind, ct);
        if (expectedETag != (row is null ? NewETag : ETag(row.ConcurrencyToken)))
            return AppResult<ProjectModuleConfigurationDto>.PreconditionFailed("Project arrangement changed; reload before saving.");
        var details = JsonSerializer.Serialize(request, RamEvaluator.Json);
        if (row?.DetailsJson == details) return AppResult<ProjectModuleConfigurationDto>.Success(ToDto(row));
        if (row is null)
        {
            row = new() { Id = Guid.NewGuid(), EventId = eventId, ActivityId = activityId,
                OccurrenceId = request.OccurrenceId, Kind = kind };
            db.EventActivityModuleConfigurations.Add(row);
        }
        row.DetailsJson = details;
        row.ConcurrencyToken = Guid.NewGuid();
        row.UpdatedByMemberId = actor;
        row.UpdatedUtc = DateTime.UtcNow;
        if (request.OccurrenceId is { } scoped)
            await invalidation.InvalidateForOccurrenceModuleChangeAsync(e, scoped, actor, rule.Module,
                "event.activity.arrangementChanged", "operational", ct);
        else
            await invalidation.InvalidateForModuleChangeAsync(e, actor, rule.Module,
                "event.activity.arrangementChanged", "operational", ct);
        try
        {
            await db.SaveChangesAsync(ct);
            if (tx is not null) await tx.CommitAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            return AppResult<ProjectModuleConfigurationDto>.PreconditionFailed("Project arrangement changed concurrently.");
        }
        catch (DbUpdateException)
        {
            return AppResult<ProjectModuleConfigurationDto>.Conflict("Project arrangement changed concurrently.");
        }
        await cache.RemoveGroupEventsAsync(e.GroupId, ct);
        return AppResult<ProjectModuleConfigurationDto>.Success(ToDto(row));
    }

    private static ProjectModuleConfigurationDto ToDto(EventActivityModuleConfiguration row) =>
        new(row.Id, row.ActivityId, row.OccurrenceId, row.Kind,
            JsonSerializer.Deserialize<SaveProjectModuleConfigurationRequest>(row.DetailsJson, RamEvaluator.Json)!,
            ETag(row.ConcurrencyToken), row.UpdatedUtc);

    private static bool ValidShape(string kind, SaveProjectModuleConfigurationRequest r)
    {
        var count = (r.Meal is null ? 0 : 1) + (r.Travel is null ? 0 : 1) + (r.Stay is null ? 0 : 1) +
                    (r.Programme is null ? 0 : 1) + (r.Roster is null ? 0 : 1);
        if (count != 1) return false;
        return kind switch
        {
            "meal" => r.Meal is { } m && Text(m.ServiceMethod) && Text(m.PreparationPlace) &&
                Text(m.DietaryHandling) && Text(m.FoodSafetyPlan),
            "travel" => r.Travel is { } t && Text(t.Origin) && Text(t.Destination) && Text(t.Timetable),
            "stay" => r.Stay is { } s && Text(s.Site) && Text(s.RoomingPlan) &&
                (s.CheckInUtc is null || s.CheckInUtc.Value.Kind == DateTimeKind.Utc) &&
                (s.CheckOutUtc is null || s.CheckOutUtc.Value.Kind == DateTimeKind.Utc) &&
                (s.CheckInUtc is null || s.CheckOutUtc is null || s.CheckInUtc < s.CheckOutUtc),
            "programme" => r.Programme is { } p && Text(p.ProductionNotes) &&
                p.ProgramItemIds is not null && p.ProgramItemIds.Count <= 100 && p.ProgramItemIds.Distinct().Count() == p.ProgramItemIds.Count,
            "roster" => r.Roster is { } s && Text(s.StaffingNotes) &&
                s.ServiceSlotIds is not null && s.ServiceSlotIds.Count <= 100 && s.ServiceSlotIds.Distinct().Count() == s.ServiceSlotIds.Count,
            _ => false
        };
    }

    private static bool Text(LocalizedTextDto? value) => value is { En: not null, Zh: not null } &&
        value.En.Length <= 4000 && value.Zh.Length <= 4000;

    private async Task<bool> ReferencesBelongToEvent(Guid eventId, string kind,
        SaveProjectModuleConfigurationRequest request, CancellationToken ct)
    {
        if (kind == "travel" && request.Travel?.JourneyId is { } journey &&
            !await db.EventTravelJourneys.AsNoTracking().AnyAsync(j => j.Id == journey && j.EventId == eventId &&
                (!request.OccurrenceId.HasValue || j.EventOccurrenceId == request.OccurrenceId), ct)) return false;
        if (kind == "programme" && request.Programme is { } programme &&
            await db.EventProgramItems.AsNoTracking().CountAsync(p => programme.ProgramItemIds.Contains(p.Id) &&
                p.Session.Occurrence.EventId == eventId &&
                (!request.OccurrenceId.HasValue || p.Session.OccurrenceId == request.OccurrenceId), ct) != programme.ProgramItemIds.Count) return false;
        if (kind == "roster" && request.Roster is { } roster &&
            await db.EventServiceSlots.AsNoTracking().CountAsync(s => roster.ServiceSlotIds.Contains(s.Id) &&
                s.Occurrence.EventId == eventId &&
                (!request.OccurrenceId.HasValue || s.OccurrenceId == request.OccurrenceId), ct) != roster.ServiceSlotIds.Count) return false;
        return true;
    }
}
