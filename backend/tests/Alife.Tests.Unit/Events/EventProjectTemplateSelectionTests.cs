using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;

namespace Alife.Tests.Unit.Events;

public class EventProjectTemplateSelectionTests
{
    private static readonly EventCompositionEngine Engine = new();
    private static readonly IReadOnlyDictionary<string, PlannedActivityAnswer> NoProjectSwitches =
        EventProjectQuestionCatalog.ProjectSwitchCodes.ToDictionary(code => code,
            _ => new PlannedActivityAnswer("no", "human", true), StringComparer.Ordinal);
    private static readonly EventTemplatePresetProjectDto Preset = new(
        "shared-meal", new("Shared meal", "共同用餐"), new("", ""), ["meal"],
        new Dictionary<string, string> { ["foodService"] = "yes" }, false);
    private static readonly EventActivityTypeDefinition Template =
        EventCompositionDefinitions.ActivityTypesByCode["shared-meal"] with
        {
            Version = 5,
            PresetProjects = [Preset]
        };

    private static EventPlanComposeRequest Request(int version, ActivityPlanData plan,
        IReadOnlyList<string>? removed = null) => new(
            EventCompositionDefinitions.SchemaVersion, "simple-social", new([]), [],
            ActivityTypeCode: "shared-meal", ActivityPlan: plan,
            ActivityTypeVersion: version, RemovedPresetKeys: removed,
            ModuleConfirmations: EventCompositionDefinitions.Modules.ToDictionary(
                module => module.Code, _ => true, StringComparer.Ordinal));

    private static EventCompositionContext Context() => new("\"plan-new\"",
        ActivityTypesByCode: new Dictionary<string, EventActivityTypeDefinition>
        {
            [Template.Code] = Template
        });

    [Fact]
    public void CreationRequiresReviewedTemplateVersionAndEveryPresetAccountedFor()
    {
        var project = new PlannedActivity("new-project", ["meal"], new("Shared meal", "共同用餐"), new(),
            SourcePresetKey: Preset.PresetKey, SourceTemplateVersion: 5, Answers: NoProjectSwitches, PresetConfirmed: true);
        var current = Engine.Compose(Request(5, new([project], QuestionnaireVersion: 2)), Context());
        Assert.True(current.IsSuccess, current.Message);

        var stale = Engine.Compose(Request(2, new([project], QuestionnaireVersion: 2)), Context());
        Assert.False(stale.IsSuccess);
        Assert.Contains("changed", stale.Message, StringComparison.OrdinalIgnoreCase);

        var omitted = Engine.Compose(Request(5, new([], QuestionnaireVersion: 2)), Context());
        Assert.False(omitted.IsSuccess);
        Assert.Contains("explicitly removed", omitted.Message, StringComparison.OrdinalIgnoreCase);

        var explicitlyRemoved = Engine.Compose(Request(5, new([], QuestionnaireVersion: 2), [Preset.PresetKey]), Context());
        Assert.True(explicitlyRemoved.IsSuccess, explicitlyRemoved.Message);
    }

    [Fact]
    public void ExistingEventRecompositionKeepsItsSavedProjectsAfterTemplateChanges()
    {
        var oldProject = new PlannedActivity("saved-project", ["meal"], new("Saved", "已保存"), new(),
            SourcePresetKey: "old-preset", SourceTemplateVersion: 2, Answers: NoProjectSwitches, PresetConfirmed: true);
        var result = Engine.Compose(Request(2, new([oldProject], QuestionnaireVersion: 2)), new("\"saved-plan\"",
            ActivityTypesByCode: Context().ActivityTypesByCode));
        Assert.True(result.IsSuccess, result.Message);
    }
}
