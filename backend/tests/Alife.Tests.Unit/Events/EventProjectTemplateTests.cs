using System.Text.Json;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Alife.Tests.Unit.Events;

public sealed class EventProjectTemplateTests
{
    [Fact]
    public void FixedQuestionDirectoryUsesIndependentApplicabilityAndDeclaredDependencies()
    {
        Assert.Equal(16, EventProjectQuestionCatalog.Definitions.Length);
        Assert.Equal(16, EventProjectQuestionCatalog.Codes.Count);
        var general = EventProjectQuestionCatalog.ApplicableQuestions([]);
        Assert.Equal(8, general.Length);
        Assert.DoesNotContain(general, q => q.Code == "foodService");
        var combined = EventProjectQuestionCatalog.ApplicableQuestions(["meal", "outdoor"]);
        Assert.Equal(10, combined.Length);
        Assert.Contains(combined, q => q.Code == "foodService"); Assert.Contains(combined, q => q.Code == "weatherPlan");
        Assert.Single(EventProjectQuestionCatalog.ApplicableQuestions(["hiking", "water", "sport"]), q => q.Code == "fitnessAttestation");
        Assert.Empty(EventProjectQuestionCatalog.DemandedModules(new Dictionary<string,string> { ["foodService"] = "yes" }, []));
        Assert.Equal(new[] { "FOOD.HOSPITALITY", "SAFETY.RAM" }, EventProjectQuestionCatalog.DemandedModules(new Dictionary<string,string> { ["foodService"] = "yes", ["weatherPlan"] = "yes" }, ["meal", "outdoor"]));
        Assert.All(EventProjectQuestionCatalog.Definitions, q => Assert.Contains("TEAM.WORK", q.Dependencies));
        Assert.Equal("scale.multiZone", EventProjectQuestionCatalog.MovedEventFactCodes["multiZoneOperations"]);
        Assert.DoesNotContain(EventProjectQuestionCatalog.Definitions, q => q.Code == "multiZoneOperations");
    }

    [Fact]
    public void SystemTemplateProjectsContainOnlyApprovedDefaultsAndRepeatOnRecurringTemplates()
    {
        Assert.Equal(16, EventCompositionDefinitions.ActivityTypes.Count);
        Assert.Equal(24, EventCompositionDefinitions.ActivityTypes.Sum(t => t.PresetProjects.Count));
        foreach (var template in EventCompositionDefinitions.ActivityTypes)
        {
            Assert.Equal(5, template.Version);
            Assert.NotEmpty(template.PresetProjects);
            Assert.Null(EventProjectQuestionCatalog.ValidatePresetProjects(template.PresetProjects));
            foreach (var project in template.PresetProjects)
            {
                Assert.Equal(16, project.DefaultAnswers.Count);
                Assert.All(EventProjectQuestionCatalog.ProjectSwitchCodes, code =>
                    Assert.Contains(project.DefaultAnswers[code], new[] { "yes", "no" }));
                Assert.Equal(template.ArchetypeCode == "recurring-gathering", project.RepeatForEachOccurrence);
                Assert.All(project.DefaultAnswers.Where(a => a.Value == "yes"), answer =>
                    Assert.Contains(EventProjectQuestionCatalog.ApplicableQuestions(project.Attributes), q => q.Code == answer.Key));
                Assert.Equal(new("", ""), project.Conditions);
            }
        }
        var children = EventCompositionDefinitions.ActivityTypes.Single(t => t.Code == "children-youth-camp").PresetProjects;
        Assert.Equal(3, children.Count);
        Assert.Equal("yes", children[0].DefaultAnswers["minorsParticipate"]);
        Assert.Equal("no", children[0].DefaultAnswers["projectFee"]);
        Assert.Equal("unknown", children[0].DefaultAnswers["organizedTransport"]);
        Assert.DoesNotContain(EventCompositionDefinitions.ActivityTypes.SelectMany(t => t.PresetProjects), p => p.Attributes.Contains("transport"));
    }

    [Theory]
    [InlineData("custom", "yes")]
    [InlineData("projectFee", "true")]
    [InlineData("projectFee", "YES")]
    public void UnknownQuestionCodesAndAnswersAreRejected(string code, string answer)
    {
        Assert.NotNull(EventProjectQuestionCatalog.ValidateAnswers(new Dictionary<string,string> { [code] = answer }));
    }

    [Fact]
    public void EfSeedRowsStayAtOriginalVersionTwoWithoutInitializingProjects()
    {
        var original = EventActivityTemplateCatalog.CreateSystemSeedEntities();
        Assert.Equal(16, original.Length);
        Assert.All(original, row => { Assert.Equal(2, row.Version); Assert.Null(row.PresetProjectsJson); });
        Assert.Equal(original.Select(row => row.Id), EventActivityTemplateCatalog.CreateSystemSeedEntities().Select(row => row.Id));
    }

    [Fact]
    public void InvalidPresetKeysAttributesAndMissingQuestionMapsAreRejected()
    {
        var project = EventCompositionDefinitions.ActivityTypes[0].PresetProjects[0];
        Assert.NotNull(EventProjectQuestionCatalog.ValidatePresetProjects([project, project]));
        Assert.NotNull(EventProjectQuestionCatalog.ValidatePresetProjects([project with { PresetKey = "Bad key" }]));
        Assert.NotNull(EventProjectQuestionCatalog.ValidatePresetProjects([project with { Attributes = ["other"] }]));
        Assert.NotNull(EventProjectQuestionCatalog.ValidatePresetProjects([project with { Attributes = ["meal", "meal"] }]));
        Assert.NotNull(EventProjectQuestionCatalog.ValidatePresetProjects([project with { DefaultAnswers = null! }]));
        Assert.NotNull(EventProjectQuestionCatalog.ValidatePresetProjects([project with { EventFactSuggestions = ["not.a.fact"] }]));
        Assert.NotNull(EventProjectQuestionCatalog.ValidatePresetProjects([project with { EventFactSuggestions = ["safety.requiresRam", "safety.requiresRam"] }]));
        Assert.Null(EventProjectQuestionCatalog.ValidatePresetProjects([project with { EventFactSuggestions = ["safety.requiresRam"] }]));
        Assert.NotNull(EventProjectQuestionCatalog.ValidatePresetProjects([project with { DefaultConfiguration = new(MinimumAge: 18, MaximumAge: 14) }]));
        Assert.NotNull(EventProjectQuestionCatalog.ValidatePresetProjects([project with { DefaultConfiguration = new(FeeMinor: -1) }]));
        Assert.Null(EventProjectQuestionCatalog.ValidatePresetProjects([project with { DefaultConfiguration = new(MinimumAge: 14, Capacity: 0, FeeChargeScope: "oncePerSeries") }]));
        Assert.Null(EventProjectQuestionCatalog.ValidatePresetProjects([]));
    }

    [Fact]
    public async Task TemplateProjectsRoundTripAndInitializationCreatesOneAuditedEvent2Successor()
    {
        await using var db = new AlifeDbContext(new DbContextOptionsBuilder<AlifeDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var definition = EventCompositionDefinitions.ActivityTypes.Single(t => t.Code == "church-camp");
        var old = EventActivityTemplateCatalog.CreateVersionEntity(definition with { Version = 2, PresetProjects = [] }, true, true, null, DateTime.UtcNow);
        old.PresetProjectsJson = null;
        var retainedName = old.NameEn; var retainedModules = old.PreselectedModulesJson; var retainedSlots = old.PresetServiceSlotsJson;
        var explicitlyEmpty = EventActivityTemplateCatalog.CreateVersionEntity(EventCompositionDefinitions.ActivityTypes.Single(t => t.Code == "prayer-meeting") with { PresetProjects = [] }, true, true, null, DateTime.UtcNow);
        db.EventActivityTemplateVersions.AddRange(old, explicitlyEmpty); await db.SaveChangesAsync();
        Assert.Equal(1, await EventActivityTemplateCatalog.InitializePresetProjectVersionsAsync(db, default));
        Assert.False(old.IsCurrent); Assert.Null(old.PresetProjectsJson);
        var current = await db.EventActivityTemplateVersions.SingleAsync(t => t.Code == "church-camp" && t.IsCurrent);
        Assert.Equal(3, current.Version); Assert.Equal(retainedName, current.NameEn);
        Assert.Equal(retainedModules, current.PreselectedModulesJson); Assert.Equal(retainedSlots, current.PresetServiceSlotsJson);
        var copied = EventActivityTemplateCatalog.ToDefinition(current);
        Assert.All(copied.PresetProjects, project => Assert.Equal(16, project.DefaultAnswers.Count));
        current.NameEn = "Administrator's camp";
        var editedProjects = copied.PresetProjects.Select((project, index) => index == 0
            ? project with
            {
                Conditions = new("Administrator notes", "管理员说明"),
                DefaultAnswers = new Dictionary<string, string>(project.DefaultAnswers, StringComparer.Ordinal)
                {
                    ["projectFee"] = "yes",
                    ["projectNotices"] = "yes"
                }
            }
            : project).ToArray();
        current.PresetProjectsJson = JsonSerializer.Serialize(editedProjects, new JsonSerializerOptions(JsonSerializerDefaults.Web));
        await db.SaveChangesAsync();
        Assert.Single(await db.AuditLogs.ToListAsync());
        Assert.Equal(0, await EventActivityTemplateCatalog.InitializePresetProjectVersionsAsync(db, default));
        Assert.True(explicitlyEmpty.IsCurrent);
        Assert.Empty(EventActivityTemplateCatalog.ToDefinition(explicitlyEmpty).PresetProjects);
        Assert.Contains("\"questionnaireVersion\":2", explicitlyEmpty.PresetProjectsJson);
        Assert.Contains("\"compositionSchemaVersion\":\"2.0.0\"", explicitlyEmpty.PresetProjectsJson);
        Assert.Equal(3, await db.EventActivityTemplateVersions.CountAsync());
        Assert.Equal(1, await EventActivityTemplateCatalog.InitializeQuestionnaireVersionsAsync(db, default));
        var successor = await db.EventActivityTemplateVersions.SingleAsync(t => t.Code == "church-camp" && t.IsCurrent);
        Assert.Equal(4, successor.Version);
        Assert.Equal("Administrator's camp", successor.NameEn);
        Assert.Contains("\"compositionSchemaVersion\":\"2.0.0\"", successor.PresetProjectsJson);
        Assert.Equal(retainedModules, successor.PreselectedModulesJson);
        Assert.Equal(retainedSlots, successor.PresetServiceSlotsJson);
        var v4Projects = EventActivityTemplateCatalog.ToDefinition(successor).PresetProjects;
        Assert.Equal("Administrator notes", v4Projects[0].Conditions.En);
        Assert.Equal("yes", v4Projects[0].DefaultAnswers["projectFee"]);
        Assert.Equal(new[] { "comms.followupRequired" }, v4Projects[0].EventFactSuggestions);
        Assert.DoesNotContain("projectNotices", v4Projects[0].DefaultAnswers.Keys);
        Assert.Equal("no", v4Projects[1].DefaultAnswers["projectFee"]);
        Assert.All(v4Projects, project => Assert.Equal(16, project.DefaultAnswers.Count));
        Assert.Equal(0, await EventActivityTemplateCatalog.InitializeQuestionnaireVersionsAsync(db, default));
        Assert.Equal(2, await db.AuditLogs.CountAsync());
    }

    [Fact]
    public async Task QuestionnaireInitializer_UpgradesCurrentAdminVersionAndPreviewDoesNotMutate()
    {
        await using var db = new AlifeDbContext(new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var original = EventCompositionDefinitions.ActivityTypes.Single(t => t.Code == "shared-meal");
        var preEvent2Projects = EventTemplateProjectDefaults.ForTemplate("shared-meal", false)
            .Select(project => project with
            {
                DefaultAnswers = new Dictionary<string, string>(project.DefaultAnswers, StringComparer.Ordinal)
                {
                    ["projectNotices"] = "yes"
                }
            }).ToArray();
        var row = EventActivityTemplateCatalog.CreateVersionEntity(original with
        {
            Version = 7,
            Name = new("Administrator's meal", "管理员聚餐"),
            PresetProjects = preEvent2Projects
        }, true, false, Guid.NewGuid(), DateTime.UtcNow);
        row.PresetProjectsJson = JsonSerializer.Serialize(
            preEvent2Projects,
            new JsonSerializerOptions(JsonSerializerDefaults.Web));
        db.EventActivityTemplateVersions.Add(row);
        await db.SaveChangesAsync();

        Assert.Equal(1, await EventActivityTemplateCatalog.InitializeQuestionnaireVersionsAsync(
            db, default, apply: false));
        Assert.True(row.IsCurrent);
        Assert.Single(await db.EventActivityTemplateVersions.ToArrayAsync());
        Assert.Empty(await db.AuditLogs.ToArrayAsync());

        Assert.Equal(1, await EventActivityTemplateCatalog.InitializeQuestionnaireVersionsAsync(db, default));
        var successor = await db.EventActivityTemplateVersions.SingleAsync(t => t.IsCurrent);
        Assert.Equal(8, successor.Version);
        Assert.Equal("Administrator's meal", successor.NameEn);
        Assert.Contains("\"questionnaireVersion\":2", successor.PresetProjectsJson);
        Assert.Contains("\"compositionSchemaVersion\":\"2.0.0\"", successor.PresetProjectsJson);
        Assert.Equal(16, EventActivityTemplateCatalog.ToDefinition(successor).PresetProjects[0].DefaultAnswers.Count);
        Assert.Equal(new[] { "comms.followupRequired" },
            EventActivityTemplateCatalog.ToDefinition(successor).PresetProjects[0].EventFactSuggestions);
        Assert.Equal(0, await EventActivityTemplateCatalog.InitializeQuestionnaireVersionsAsync(db, default));
    }
}
