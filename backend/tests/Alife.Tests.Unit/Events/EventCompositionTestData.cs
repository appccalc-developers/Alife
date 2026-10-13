using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;

namespace Alife.Tests.Unit.Events;

internal static class EventCompositionTestData
{
    public static ActivityPlanData ConfirmedPresetPlan(EventActivityTypeDefinition definition)
        => new(definition.PresetProjects.Select(project => new PlannedActivity(
            $"preset:{project.PresetKey}",
            project.Attributes,
            new(project.Name.En, project.Name.Zh),
            new(project.Conditions.En, project.Conditions.Zh),
            SourcePresetKey: project.PresetKey,
            SourceTemplateVersion: definition.Version,
            Answers: EventProjectQuestionCatalog.GeneralSwitchCodes
                .ToDictionary(
                    code => code,
                    code => new PlannedActivityAnswer(
                        project.DefaultAnswers.GetValueOrDefault(code) ?? "no",
                        "template",
                        true),
                    StringComparer.Ordinal)
                .Concat(project.DefaultAnswers
                    .Where(answer => !EventProjectQuestionCatalog.GeneralSwitchCodes.Contains(answer.Key))
                    .Select(answer => new KeyValuePair<string, PlannedActivityAnswer>(
                        answer.Key,
                        new(answer.Value, "template", true))))
                .ToDictionary(answer => answer.Key, answer => answer.Value, StringComparer.Ordinal),
            PresetConfirmed: true,
            RepeatForEachOccurrence: project.RepeatForEachOccurrence,
            DefaultConfiguration: project.DefaultConfiguration)).ToArray(),
            QuestionnaireVersion: 2);

    public static EventPlanComposeRequest CurrentRequest(
        IReadOnlyList<EventFactInputDto>? facts = null,
        IReadOnlyList<ModuleSelectionInput>? selections = null,
        ActivityPlanData? activityPlan = null,
        string archetypeCode = "simple-social",
        string activityTypeCode = "shared-meal",
        int? activityTypeVersion = null,
        IReadOnlyList<string>? removedPresetKeys = null)
        => new(
            EventCompositionDefinitions.SchemaVersion,
            archetypeCode,
            new(facts ?? []),
            selections ?? [],
            ActivityTypeCode: activityTypeCode,
            ModuleConfirmations: EventCompositionDefinitions.Modules.ToDictionary(
                module => module.Code,
                _ => true,
                StringComparer.Ordinal),
            ActivityPlan: activityPlan ?? EventActivityPlanService.Empty,
            ActivityTypeVersion: activityTypeVersion,
            RemovedPresetKeys: removedPresetKeys);

    public static string CurrentEventData(
        string titleEn,
        string titleZh,
        DateTime start,
        DateTime end,
        string visibility = "groupVisible",
        string registrationMode = "none") =>
        System.Text.Json.JsonSerializer.Serialize(new
        {
            visibility,
            title = new { en = titleEn, zh = titleZh },
            description = new { en = "Description", zh = "说明" },
            locationName = new { en = "Hall", zh = "礼堂" },
            startDate = start,
            endDate = end,
            registrationDeadline = start,
            maxCapacity = registrationMode == "required" ? 20 : 0,
            registrationMode,
            capacityUnit = "People",
            hardConstraints = Array.Empty<object>(),
            currency = "NZD",
            galleryUrls = Array.Empty<string>(),
            timeZone = "Australia/Perth"
        });
}
