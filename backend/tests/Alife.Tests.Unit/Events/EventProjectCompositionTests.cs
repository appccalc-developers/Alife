using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Domain.Enums;
using System.Text.Json;

namespace Alife.Tests.Unit.Events;

public class EventProjectCompositionTests
{
    private static readonly EventCompositionEngine Engine = new();

    private static PlannedActivity Project(string id, string[] attributes,
        params (string Code, string Value, bool Confirmed)[] answers) => new(
        id, attributes, new(id, id), new(), Answers: EventProjectQuestionCatalog.ProjectSwitchCodes
            .ToDictionary(code => code, _ => new PlannedActivityAnswer("no", "human", true), StringComparer.Ordinal)
            .Concat(answers.Select(answer => new KeyValuePair<string, PlannedActivityAnswer>(
                answer.Code, new(answer.Value, "human", answer.Confirmed))))
            .GroupBy(pair => pair.Key, StringComparer.Ordinal)
            .ToDictionary(group => group.Key, group => group.Last().Value, StringComparer.Ordinal));

    private static EventPlanProposalDto Compose(params PlannedActivity[] projects) => ComposeWithFacts([], projects);
    private static EventPlanProposalDto ComposeWithFacts(IReadOnlyList<EventFactInputDto> facts, params PlannedActivity[] projects)
    {
        var result = Engine.Compose(new(EventCompositionDefinitions.SchemaVersion,
            "simple-social", new(facts), [], ActivityTypeCode: "shared-meal",
            ModuleConfirmations: EventCompositionDefinitions.Modules.ToDictionary(
                module => module.Code, _ => true, StringComparer.Ordinal),
            ActivityPlan: new(projects, QuestionnaireVersion: 2)), new("\"project-test\"", CheckedUtc: DateTime.UnixEpoch));
        Assert.True(result.IsSuccess, result.Message);
        return result.Value!;
    }
    private static EventFactInputDto Fact(string code, bool value) =>
        new(code, JsonSerializer.SerializeToElement(value), EventFactCertainty.Confirmed, EventFactSource.Human);

    private static EventModuleDecisionStatus Status(EventPlanProposalDto plan, string code) =>
        plan.ModuleDecisions.Single(module => module.ModuleCode == code).Status;

    [Fact]
    public void Projects_UnionConfirmedYes_NeitherNoNorAttributeRemovalCancelsAnotherYes()
    {
        var plan = Compose(
            Project("meal-outdoor", ["meal", "outdoor"],
                ("foodService", "yes", true), ("weatherPlan", "yes", true)),
            Project("water-outdoor", ["water", "outdoor"],
                ("foodService", "no", true), ("weatherPlan", "no", true),
                ("waterSafety", "yes", true)));

        Assert.Equal(EventModuleDecisionStatus.Required, Status(plan, "FOOD.HOSPITALITY"));
        Assert.Equal(EventModuleDecisionStatus.Required, Status(plan, "SAFETY.RAM"));
        Assert.Equal(1, plan.ModuleDecisions.Count(module => module.ModuleCode == "SAFETY.RAM"));
        Assert.Contains(plan.ProjectSources!, source => source.ActivityId == "meal-outdoor" &&
            source.ModuleCode == "FOOD.HOSPITALITY");
        Assert.DoesNotContain(plan.ProjectSources!, source => source.ActivityId == "water-outdoor" &&
            source.ModuleCode == "FOOD.HOSPITALITY");

        var withoutMeal = Compose(Project("meal-outdoor", ["outdoor"],
            ("foodService", "yes", true), ("weatherPlan", "yes", true)));
        Assert.Equal(EventModuleDecisionStatus.Inactive, Status(withoutMeal, "FOOD.HOSPITALITY"));
        Assert.Equal(EventModuleDecisionStatus.Required, Status(withoutMeal, "SAFETY.RAM"));
    }

    [Fact]
    public void UnknownIsNotNo_TemplateYesNeedsConfirmation_AndAnswersChangeHash()
    {
        var unknown = Compose(Project("meal", ["meal"], ("foodService", "unknown", false)));
        var unconfirmed = Compose(Project("meal", ["meal"], ("foodService", "yes", false)));
        var confirmed = Compose(Project("meal", ["meal"], ("foodService", "yes", true)));
        Assert.Equal(EventModuleDecisionStatus.Inactive, Status(unknown, "FOOD.HOSPITALITY"));
        Assert.Equal(EventModuleDecisionStatus.Selected, Status(unconfirmed, "FOOD.HOSPITALITY"));
        Assert.Equal(EventModuleDecisionStatus.Required, Status(confirmed, "FOOD.HOSPITALITY"));
        Assert.NotEqual(unknown.ProposalHash, unconfirmed.ProposalHash);
        Assert.NotEqual(unconfirmed.ProposalHash, confirmed.ProposalHash);
    }

    [Fact]
    public void GeneralProject_StaysSafeAndEmpty_WhileMultiZoneRequirementBlocksSubmission()
    {
        var general = Compose(Project("general", []));
        Assert.Empty(general.ProjectSources!);
        Assert.Equal(EventModuleDecisionStatus.Inactive, Status(general, "SAFETY.RAM"));

        var festival = ComposeWithFacts([Fact("scale.multiZone", true)], Project("festival", []));
        Assert.Equal(EventModuleDecisionStatus.Inactive, Status(festival, "FESTIVAL.OPERATIONS"));
        Assert.Contains(EventCompositionEngine.FormalSubmissionModuleBlockers(festival),
            blocker => blocker.En.Contains("Multi-zone", StringComparison.Ordinal));
    }

    [Fact]
    public void CurrentSchemaRequiresProjectList_AndOldSchemaIsUnsupported()
    {
        var current = Engine.Compose(new(EventCompositionDefinitions.SchemaVersion,
            "simple-social", new([]), [], ActivityTypeCode: "shared-meal"),
            new("\"current\""));
        var old = Engine.Compose(new("1.3.0",
            "simple-social", new([]), [], ActivityTypeCode: "shared-meal"),
            new("\"old\""));
        Assert.False(current.IsSuccess);
        Assert.False(old.IsSuccess);
        Assert.Equal(EventCompositionDefinitions.UnsupportedSchemaErrorCode, old.Code);
    }

    [Theory]
    [InlineData("unknown", true)]
    [InlineData("yes", false)]
    public void UnresolvedMealQuestion_BlocksFormalSubmissionWhileDraftCompositionSucceeds(string answer, bool confirmed)
    {
        var questions = EventProjectQuestionCatalog.ApplicableQuestions(["meal"])
            .ToDictionary(q => q.Code, _ => new PlannedActivityAnswer("no", "human", true));
        questions["foodService"] = new(answer, "human", confirmed);
        var project = new PlannedActivity("meal", ["meal"], new("Meal", "聚餐"), new(), Answers: questions);
        var plan = Compose(project);
        var blockers = EventCompositionEngine.FormalSubmissionModuleBlockers(plan, new([project]));
        Assert.Contains(blockers, b => b.En.Contains("food service", StringComparison.Ordinal));
        questions["foodService"] = new("no", "human", true);
        Assert.Empty(EventCompositionEngine.FormalSubmissionModuleBlockers(ComposeWithFacts([
            Fact("safety.requiresRam", false),
            Fact("comms.followupRequired", false),
            Fact("scale.multiZone", false)
        ], project), new([project])));
    }

    [Fact]
    public void MissingAnswerAndUnreviewedPreset_BlockFormalSubmission()
    {
        var answers = EventProjectQuestionCatalog.ApplicableQuestions(["meal"]).ToDictionary(q => q.Code, _ => new PlannedActivityAnswer("no", "human", true));
        answers.Remove("foodService");
        var project = new PlannedActivity("preset", ["meal"], new("Preset", "预设"), new(), SourcePresetKey: "preset", SourceTemplateVersion: 1, Answers: answers, PresetConfirmed: false);
        var blockers = EventCompositionEngine.FormalSubmissionModuleBlockers(Compose(project), new([project]));
        Assert.Contains(blockers, b => b.En.Contains("template defaults", StringComparison.Ordinal));
        Assert.Contains(blockers, b => b.En.Contains("food service", StringComparison.Ordinal));
    }

    [Fact]
    public void EventLevelAnswersRequireExplicitHumanConfirmation_AndMultiZoneStillBlocks()
    {
        var project = Project("ordinary", []);
        var unknown = Compose(project);
        Assert.Equal(3, EventCompositionEngine.FormalSubmissionModuleBlockers(unknown, new([project]))
            .Count(blocker => blocker.En.Contains("Event-level question", StringComparison.Ordinal)));

        var allNo = ComposeWithFacts([
            Fact("safety.requiresRam", false),
            Fact("comms.followupRequired", false),
            Fact("scale.multiZone", false)
        ], project);
        Assert.Empty(EventCompositionEngine.FormalSubmissionModuleBlockers(allNo, new([project])));

        var multiZone = ComposeWithFacts([
            Fact("safety.requiresRam", false),
            Fact("comms.followupRequired", false),
            Fact("scale.multiZone", true)
        ], project);
        Assert.Contains(EventCompositionEngine.FormalSubmissionModuleBlockers(multiZone, new([project])),
            blocker => blocker.En.Contains("Multi-zone operations", StringComparison.Ordinal));
    }

    [Fact]
    public void RetiredProjectLevelEventAnswerCodesAreRejected()
    {
        var project = Project("legacy", [], ("safetyReview", "yes", true), ("projectNotices", "yes", true));
        var result = Engine.Compose(new(EventCompositionDefinitions.SchemaVersion,
            "simple-social", new([]), [], ActivityTypeCode: "shared-meal",
            ModuleConfirmations: EventCompositionDefinitions.Modules.ToDictionary(
                module => module.Code, _ => true, StringComparer.Ordinal),
            ActivityPlan: new([project], QuestionnaireVersion: 2)), new("\"current\""));

        Assert.False(result.IsSuccess);
        Assert.Contains("question", result.Message!, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void HistoricalProjectSchemaIsRejected()
    {
        var historical = Project("old", []);
        var result = Engine.Compose(new("1.2.0",
            "simple-social", new([]), [], ActivityTypeCode: "shared-meal",
            ActivityPlan: new([historical], QuestionnaireVersion: 2)), new("\"historic\""));
        Assert.False(result.IsSuccess);
        Assert.Equal(EventCompositionDefinitions.UnsupportedSchemaErrorCode, result.Code);
    }

    [Fact]
    public void OnlyProjectSelectionTriggersEventRegistrationConflictInCurrentSchema()
    {
        var noRegistration = new EventFactInputDto("people.registrationMode",
            JsonSerializer.SerializeToElement("none"), EventFactCertainty.Confirmed, EventFactSource.Human);
        var ageOnly = ComposeWithFacts([noRegistration], Project("age-only", [],
            ("ageEligibility", "yes", true)));
        Assert.Equal(EventModuleDecisionStatus.Required, Status(ageOnly, "PEOPLE.REGISTRATION"));
        Assert.DoesNotContain(EventCompositionEngine.FormalSubmissionModuleBlockers(ageOnly),
            blocker => blocker.En.Contains("Project enrolment", StringComparison.Ordinal));

        var selectable = ComposeWithFacts([noRegistration], Project("selectable", [],
            ("projectSelection", "yes", true)));
        Assert.Contains(EventCompositionEngine.FormalSubmissionModuleBlockers(selectable),
            blocker => blocker.En.Contains("Project enrolment", StringComparison.Ordinal));

    }
}
