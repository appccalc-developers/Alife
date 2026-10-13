using System.Text.Json;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Xunit;

namespace Alife.Tests.Unit.Events;

public partial class RamGovernanceTests
{
    [Theory]
    [InlineData("", "generic")]
    [InlineData("meal", "generic,meal")]
    [InlineData("meal,outdoor", "generic,meal,outdoor")]
    [InlineData("water,outdoor", "generic,water,outdoor")]
    public void AttributesMatchUnionInPolicyOrder(string selected, string expected)
    {
        var questions = new[] { "generic", "meal", "water", "outdoor" }.Select(code => new RamQuestion(code, code, "activity", Text(code), Text(code))).ToArray();
        var policy = Policy() with { Questions = [..questions, questions[0]] };
        var activity = new RamActivity { Attributes = selected.Length == 0 ? [] : selected.Split(',') };
        Assert.Equal(expected.Split(','), RamEvaluator.Questions(policy, activity).Select(q => q.Code));
        Assert.Equal("meal:meal", RamEvaluator.QuestionKey(questions[1]));
    }

    [Fact]
    public void AttributesAreRequiredFixedAndIndependent()
    {
        var answers = EventProjectQuestionCatalog.GeneralSwitchCodes.ToDictionary(code => code,
            _ => new PlannedActivityAnswer("no", "human", true), StringComparer.Ordinal);
        foreach (var codes in new string[]?[] { null, ["generic"], ["other"], ["craft"], ["meal", "meal"], ["bad code"] })
            Assert.NotNull(EventActivityPlanService.Validate(new([new("new", codes!, Text("Test"), new(), Answers: answers)], QuestionnaireVersion: 2)));
        var independent = new ActivityPlanData([new("new", ["hiking"], Text("Hike"), new(), Answers: answers)], QuestionnaireVersion: 2);
        Assert.Null(EventActivityPlanService.Validate(independent));
        Assert.False(independent.IsOuting); Assert.False(independent.IsOvernight);
        Assert.Null(EventActivityPlanService.Validate(new([new("new", [], Text("Test"), new(), Answers: answers)], QuestionnaireVersion: 2)));
        Assert.Throws<JsonException>(() => EventActivityPlanService.Parse("{\"activities\":[{\"id\":\"old\",\"type\":\"meal\",\"name\":{\"en\":\"Old\",\"zh\":\"Old\"},\"conditions\":{}}]}"));
        Assert.Throws<JsonException>(() => RamEvaluator.Parse("{\"schemaVersion\":2,\"activities\":[{\"id\":\"old\",\"type\":\"meal\"}]}"));
        var json = RamEvaluator.Serialize(independent);
        Assert.Contains("attributes", json); Assert.DoesNotContain("type", json);
        var draft = Draft(Policy()); draft.Activities[0].Attributes = ["craft"];
        Assert.Contains(RamEvaluator.Evaluate(draft, Policy()).Errors, e => e.StartsWith("ram.activities:"));
    }

    [Fact]
    public async Task PlanPreviewAndSaveRequireMultipleAttributes()
    {
        using var f = await Fixture.Create();
        var service = new EventActivityPlanService(f.Db, new EventPackageInvalidationService(f.Db), f.Cache);
        var view = (await service.GetAsync(f.Event, f.Author, default)).Value!;
        Assert.Null(view.CheckItems);
        await f.Publish();
        view = (await service.GetAsync(f.Event, f.Author, default)).Value!;
        Assert.Contains(view.CheckItems!, q => q.ActivityType == "meal");
        var data = view.Data with { Activities = view.Data.Activities.Select(a => a with { Attributes = ["meal", "outdoor"] }).ToArray() };
        var saved = await service.SaveAsync(f.Event, f.Author, new(data, view.ETag), default);
        Assert.True(saved.IsSuccess, saved.Message);
        var reordered = saved.Value!.Data with { Activities = saved.Value.Data.Activities.Select(a => a with { Attributes = ["outdoor", "meal"] }).ToArray() };
        Assert.Equal(saved.Value.ETag, (await service.SaveAsync(f.Event, f.Author, new(reordered, saved.Value.ETag), default)).Value!.ETag);
        var missing = saved.Value.Data with { Activities = saved.Value.Data.Activities.Select(a => a with { Attributes = null! }).ToArray(), ParticipantCount = 20 };
        Assert.Equal(AppResultStatus.ValidationError, (await service.SaveAsync(f.Event, f.Author, new(missing, saved.Value.ETag), default)).Status);
        Assert.Equal(new[] { "meal", "outdoor" }, (await service.GetAsync(f.Event, f.Author, default)).Value!.Data.Activities[0].Attributes);
        Assert.Equal(AppResultStatus.Forbidden, (await service.GetAsync(f.Event, f.Other, default)).Status);
        Assert.Equal(AppResultStatus.Forbidden, (await service.SaveAsync(f.Event, f.Other, new(data, saved.Value.ETag), default)).Status);
        Assert.Equal(AppResultStatus.PreconditionFailed, (await service.SaveAsync(f.Event, f.Author, new(data, view.ETag), default)).Status);
        var cleared = saved.Value.Data with { Activities = saved.Value.Data.Activities.Select(a => a with { Attributes = [] }).ToArray() };
        var result = await service.SaveAsync(f.Event, f.Author, new(cleared, saved.Value.ETag), default);
        Assert.True(result.IsSuccess, result.Message); Assert.Empty(result.Value!.Data.Activities[0].Attributes);
    }

    [Fact]
    public void SyncRisksCannotBorrowAnotherActivityAttribute()
    {
        var draft = new RamV2Draft { Activities = [new() { Id = "meal", Attributes = ["meal", "outdoor"], Name = Text("Picnic") }, new() { Id = "water", Attributes = ["water"], Name = Text("Pool") }] };
        var risk = new RamSyncRisk("outdoor", "environment", Text("Weather"), Text("Impact"), Text("Check"), Text("Verify"), "a1");
        Assert.Throws<InvalidDataException>(() => RamSyncPolicy.Merge(draft, [risk], "[]", out _));
        var result = RamSyncPolicy.Merge(draft, [risk with { ActivityKey = "a0" }], "[]", out _);
        Assert.Equal("meal", Assert.Single(result.Hazards).ActivityId);
    }

    [Theory]
    [InlineData("other")]
    [InlineData("craft")]
    public async Task PoliciesRejectNonFixedAttributeScopes(string scope)
    {
        using var f = await Fixture.Create();
        var invalid = Policy() with { Questions = [new("tools", scope, "activity", Text("Which tools?"), Text("Check tools"))] };
        Assert.NotEmpty(RamEvaluator.ValidatePolicy(invalid, true));
        Assert.Equal(AppResultStatus.ValidationError, (await f.Service.SavePolicyAsync(f.Church, f.Author, new(invalid, null, "new"), default)).Status);
        var valid = Policy();
        Assert.DoesNotContain("activityContentCategories", RamEvaluator.Serialize(valid));
        Assert.Equal(AppResultStatus.Forbidden, (await f.Service.SavePolicyAsync(f.Church, f.Other, new(valid, null, "new"), default)).Status);
    }
}
