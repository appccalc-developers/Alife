using Alife.Application.Common.Interfaces;
using Alife.Application.Events.Dtos;
using Alife.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Services;

/// <summary>Maps the relational activity plan to the unchanged questionnaire contract.</summary>
public static class EventActivityPlanPersistence
{
    public static Task<EventActivityPlan?> LoadAsync(IAlifeDbContext db, Guid eventId, bool tracking, CancellationToken ct)
    {
        IQueryable<EventActivityPlan> query = db.EventActivityPlans
            .Include(x => x.Projects).ThenInclude(x => x.Attributes)
            .Include(x => x.Projects).ThenInclude(x => x.Answers)
            .Include(x => x.Projects).ThenInclude(x => x.Defaults);
        return (tracking ? query : query.AsNoTracking()).FirstOrDefaultAsync(x => x.EventId == eventId, ct);
    }

    public static ActivityPlanData ToData(EventActivityPlan row) => new(
        row.Projects.OrderBy(x => x.SortOrder).ThenBy(x => x.ActivityId, StringComparer.Ordinal)
            .Select(project => new PlannedActivity(
                project.ActivityId,
                project.Attributes.Select(x => x.AttributeCode)
                    .OrderBy(x => Array.IndexOf(ActivityAttributes.Codes, x)).ToArray(),
                new(project.NameEn, project.NameZh),
                new(project.ConditionsEn, project.ConditionsZh),
                project.OccurrenceId, project.SourcePresetKey, project.SourceTemplateVersion,
                AsUtc(project.StartUtc), AsUtc(project.EndUtc),
                project.Answers.OrderBy(x => x.QuestionCode, StringComparer.Ordinal)
                    .ToDictionary(x => x.QuestionCode,
                        x => new PlannedActivityAnswer(x.Value, x.Source, x.Confirmed), StringComparer.Ordinal),
                project.PresetConfirmed, project.RepeatForEachOccurrence,
                project.Defaults is null ? null : ToDefaults(project.Defaults))).ToArray(),
        row.ParticipantCount, row.IsOuting, row.IsOvernight, row.IsHighRisk,
        row.WeatherConfirmationEn is null && row.WeatherConfirmationZh is null
            ? null : new(row.WeatherConfirmationEn ?? "", row.WeatherConfirmationZh ?? ""),
        row.QuestionnaireVersion);

    public static EventActivityPlan New(Guid eventId, ActivityPlanData data, DateTime now)
    {
        var row = new EventActivityPlan { EventId = eventId, UpdatedUtc = now };
        AssignHeader(row, data);
        for (var index = 0; index < data.Activities.Length; index++)
            row.Projects.Add(NewProject(eventId, data.Activities[index], index));
        return row;
    }

    public static async Task<bool> HasReferencesAsync(IAlifeDbContext db, Guid eventId,
        string[] activityIds, CancellationToken ct) => activityIds.Length > 0 &&
        (await db.EventActivityPolicyVersions.AsNoTracking().AnyAsync(x => x.EventId == eventId && activityIds.Contains(x.ActivityId), ct) ||
         await db.EventActivityOffers.AsNoTracking().AnyAsync(x => x.EventId == eventId && activityIds.Contains(x.ActivityId), ct) ||
         await db.EventActivityModuleConfigurations.AsNoTracking().AnyAsync(x => x.EventId == eventId && activityIds.Contains(x.ActivityId), ct) ||
         await db.EventTasks.AsNoTracking().AnyAsync(x => x.EventId == eventId && x.ActivityId != null && activityIds.Contains(x.ActivityId), ct));

    public static void Replace(IAlifeDbContext db, EventActivityPlan row, ActivityPlanData data, DateTime now)
    {
        AssignHeader(row, data);
        row.UpdatedUtc = now;
        row.ConcurrencyToken = Guid.NewGuid();
        var incoming = data.Activities.ToDictionary(x => x.Id, StringComparer.Ordinal);
        foreach (var project in row.Projects.ToArray())
        {
            if (incoming.ContainsKey(project.ActivityId)) continue;
            db.EventActivityProjects.Remove(project);
            row.Projects.Remove(project);
        }
        var existing = row.Projects.ToDictionary(x => x.ActivityId, StringComparer.Ordinal);
        for (var index = 0; index < data.Activities.Length; index++)
        {
            var value = data.Activities[index];
            if (!existing.TryGetValue(value.Id, out var project))
            {
                row.Projects.Add(NewProject(row.EventId, value, index));
                continue;
            }
            AssignProject(project, value, index);
            var attributes = value.Attributes.ToHashSet(StringComparer.Ordinal);
            foreach (var old in project.Attributes.Where(x => !attributes.Contains(x.AttributeCode)).ToArray())
            {
                db.EventActivityProjectAttributes.Remove(old);
                project.Attributes.Remove(old);
            }
            var knownAttributes = project.Attributes.Select(x => x.AttributeCode).ToHashSet(StringComparer.Ordinal);
            foreach (var code in value.Attributes.Where(x => !knownAttributes.Contains(x)))
                project.Attributes.Add(new() { EventId = row.EventId, ActivityId = value.Id, AttributeCode = code });

            var answers = value.Answers ?? new Dictionary<string, PlannedActivityAnswer>();
            foreach (var old in project.Answers.Where(x => !answers.ContainsKey(x.QuestionCode)).ToArray())
            {
                db.EventActivityProjectAnswers.Remove(old);
                project.Answers.Remove(old);
            }
            var knownAnswers = project.Answers.ToDictionary(x => x.QuestionCode, StringComparer.Ordinal);
            foreach (var (code, answer) in answers)
            {
                if (knownAnswers.TryGetValue(code, out var current))
                {
                    current.Value = answer.Value;
                    current.Source = answer.Source;
                    current.Confirmed = answer.Confirmed;
                }
                else project.Answers.Add(new() { EventId = row.EventId, ActivityId = value.Id,
                    QuestionCode = code, Value = answer.Value, Source = answer.Source, Confirmed = answer.Confirmed });
            }
            if (value.DefaultConfiguration is null && project.Defaults is not null)
            {
                db.EventActivityProjectDefaults.Remove(project.Defaults);
                project.Defaults = null;
            }
            else if (value.DefaultConfiguration is not null)
            {
                project.Defaults ??= new() { EventId = row.EventId, ActivityId = value.Id };
                AssignDefaults(project.Defaults, value.DefaultConfiguration);
            }
        }
    }

    private static void AssignHeader(EventActivityPlan row, ActivityPlanData data)
    {
        row.QuestionnaireVersion = data.QuestionnaireVersion!.Value;
        row.ParticipantCount = data.ParticipantCount;
        row.IsOuting = data.IsOuting;
        row.IsOvernight = data.IsOvernight;
        row.IsHighRisk = data.IsHighRisk;
        row.WeatherConfirmationEn = data.WeatherConfirmation?.En;
        row.WeatherConfirmationZh = data.WeatherConfirmation?.Zh;
    }

    // SQL Server datetime2 stores the UTC instant but not DateTime.Kind.
    private static DateTime? AsUtc(DateTime? value) => value.HasValue
        ? DateTime.SpecifyKind(value.Value, DateTimeKind.Utc) : null;

    private static EventActivityProject NewProject(Guid eventId, PlannedActivity value, int order)
    {
        var project = new EventActivityProject { EventId = eventId, ActivityId = value.Id };
        AssignProject(project, value, order);
        foreach (var code in value.Attributes)
            project.Attributes.Add(new() { EventId = eventId, ActivityId = value.Id, AttributeCode = code });
        foreach (var (code, answer) in value.Answers ?? new Dictionary<string, PlannedActivityAnswer>())
            project.Answers.Add(new() { EventId = eventId, ActivityId = value.Id,
                QuestionCode = code, Value = answer.Value, Source = answer.Source, Confirmed = answer.Confirmed });
        if (value.DefaultConfiguration is not null)
        {
            project.Defaults = new() { EventId = eventId, ActivityId = value.Id };
            AssignDefaults(project.Defaults, value.DefaultConfiguration);
        }
        return project;
    }

    private static void AssignProject(EventActivityProject project, PlannedActivity value, int order)
    {
        project.SortOrder = order;
        project.NameEn = value.Name.En;
        project.NameZh = value.Name.Zh;
        project.ConditionsEn = value.Conditions.En;
        project.ConditionsZh = value.Conditions.Zh;
        project.OccurrenceId = value.OccurrenceId;
        project.SourcePresetKey = value.SourcePresetKey;
        project.SourceTemplateVersion = value.SourceTemplateVersion;
        project.StartUtc = value.StartUtc;
        project.EndUtc = value.EndUtc;
        project.PresetConfirmed = value.PresetConfirmed;
        project.RepeatForEachOccurrence = value.RepeatForEachOccurrence;
    }

    private static ProjectConfigurationDefaultsDto ToDefaults(EventActivityProjectDefaults value) => new(
        value.EligibilityEn is null && value.EligibilityZh is null ? null : new(value.EligibilityEn ?? "", value.EligibilityZh ?? ""),
        value.MinimumAge, value.MaximumAge, value.Capacity, value.AllowWaitlist,
        value.RequiresGuardianConsent, value.FeeMinor, value.Currency, value.FeeChargeScope,
        value.TermsEn is null && value.TermsZh is null ? null : new(value.TermsEn ?? "", value.TermsZh ?? ""));

    private static void AssignDefaults(EventActivityProjectDefaults row, ProjectConfigurationDefaultsDto value)
    {
        row.EligibilityEn = value.Eligibility?.En;
        row.EligibilityZh = value.Eligibility?.Zh;
        row.MinimumAge = value.MinimumAge;
        row.MaximumAge = value.MaximumAge;
        row.Capacity = value.Capacity;
        row.AllowWaitlist = value.AllowWaitlist;
        row.RequiresGuardianConsent = value.RequiresGuardianConsent;
        row.FeeMinor = value.FeeMinor;
        row.Currency = value.Currency;
        row.FeeChargeScope = value.FeeChargeScope;
        row.TermsEn = value.Terms?.En;
        row.TermsZh = value.Terms?.Zh;
    }
}
