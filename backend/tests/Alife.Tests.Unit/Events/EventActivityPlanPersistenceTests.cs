using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Domain.Entities;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Alife.Tests.Unit.Events;

public sealed class EventActivityPlanPersistenceTests
{
    [Fact]
    public async Task RelationalPlan_RoundTripsOrderedProjectsAttributesAnswersAndHints()
    {
        var options = new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        var eventId = Guid.NewGuid();
        var first = new PlannedActivity("first", ["outdoor", "meal"], new("Lunch", "午餐"),
            new("Bring food", "自带食物"), Answers: new Dictionary<string, PlannedActivityAnswer>
            {
                ["foodService"] = new("yes", "template", true),
                ["weatherPlan"] = new("unknown", "human", false)
            }, DefaultConfiguration: new(new("Adults", "成人"), 18, null, 20,
                true, false, 500, "NZD", "perOccurrence", new("Terms", "条款")));
        var second = new PlannedActivity("second", [], new("Welcome", "欢迎"), new("", ""));
        await using (var db = new AlifeDbContext(options))
        {
            db.EventActivityPlans.Add(EventActivityPlanPersistence.New(eventId,
                new([first, second], 40, true, false, false, new("Weather", "天气"), 2), DateTime.UtcNow));
            await db.SaveChangesAsync();
        }
        await using (var db = new AlifeDbContext(options))
        {
            var row = await EventActivityPlanPersistence.LoadAsync(db, eventId, true, default);
            Assert.NotNull(row);
            var data = EventActivityPlanPersistence.ToData(row);
            Assert.Equal(2, data.QuestionnaireVersion);
            Assert.Equal(["first", "second"], data.Activities.Select(x => x.Id));
            Assert.Equal(["meal", "outdoor"], data.Activities[0].Attributes);
            Assert.Equal("自带食物", data.Activities[0].Conditions.Zh);
            Assert.Equal("unknown", data.Activities[0].Answers!["weatherPlan"].Value);
            Assert.Equal(500, data.Activities[0].DefaultConfiguration!.FeeMinor);
            Assert.Empty(data.Activities[1].Attributes);

            var etag = row.ConcurrencyToken;
            EventActivityPlanPersistence.Replace(db, row,
                data with { Activities = [second, first with { Attributes = ["water", "outdoor"] }] },
                DateTime.UtcNow);
            await db.SaveChangesAsync();
            Assert.NotEqual(etag, row.ConcurrencyToken);
        }
        await using (var db = new AlifeDbContext(options))
        {
            var row = await EventActivityPlanPersistence.LoadAsync(db, eventId, false, default);
            var data = EventActivityPlanPersistence.ToData(row!);
            Assert.Equal(["second", "first"], data.Activities.Select(x => x.Id));
            Assert.Equal(["water", "outdoor"], data.Activities[1].Attributes);
            Assert.Single(db.EventActivityProjectAnswers.Where(x => x.QuestionCode == "foodService"));
        }
    }

    [Fact]
    public async Task RelationalPlan_SupportsZeroProjects()
    {
        var options = new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        var eventId = Guid.NewGuid();
        await using var db = new AlifeDbContext(options);
        db.EventActivityPlans.Add(EventActivityPlanPersistence.New(eventId,
            new([], QuestionnaireVersion: 2), DateTime.UtcNow));
        await db.SaveChangesAsync();
        var read = await EventActivityPlanPersistence.LoadAsync(db, eventId, false, default);
        Assert.Empty(EventActivityPlanPersistence.ToData(read!).Activities);
    }

    [Fact]
    public async Task TaskProjectLink_PreventsDeletingOrRebindingTheProject()
    {
        var options = new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        var eventId = Guid.NewGuid();
        await using var db = new AlifeDbContext(options);
        db.EventActivityPlans.Add(EventActivityPlanPersistence.New(eventId,
            new([new("linked", [], new("Project", "项目"), new("", ""))], QuestionnaireVersion: 2),
            DateTime.UtcNow));
        db.EventTasks.Add(new EventTask { Id = Guid.NewGuid(), EventId = eventId,
            ActivityId = "linked" });
        await db.SaveChangesAsync();

        Assert.True(await EventActivityPlanPersistence.HasReferencesAsync(db, eventId, ["linked"], default));
        Assert.False(await EventActivityPlanPersistence.HasReferencesAsync(db, eventId, ["other"], default));
    }

    [Fact]
    public void SqlDateTime2_ProjectTimesRemainUtcInTheApiContract()
    {
        var start = new DateTime(2026, 11, 2, 9, 0, 0, DateTimeKind.Unspecified);
        var row = new EventActivityPlan
        {
            QuestionnaireVersion = 2,
            Projects = [new EventActivityProject
            {
                ActivityId = "timed", NameEn = "Timed", NameZh = "定时项目",
                StartUtc = start, EndUtc = start.AddHours(1)
            }]
        };

        var activity = Assert.Single(EventActivityPlanPersistence.ToData(row).Activities);
        Assert.Equal(DateTimeKind.Utc, activity.StartUtc!.Value.Kind);
        Assert.Equal(DateTimeKind.Utc, activity.EndUtc!.Value.Kind);
        Assert.Equal(start.Ticks, activity.StartUtc.Value.Ticks);
    }
}
