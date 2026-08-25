using System.Text.Json;
using Alife.Application.Common.Models;
using Alife.Application.Events.Commands.GenerateEventSeriesInstances;
using Alife.Application.Events.Commands.SaveEventSeries;
using Alife.Application.Events.Queries.ListEventSeries;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.Events;

public sealed class EventSeriesWorkflowTests
{
    [Fact]
    public void Occurrence_dates_are_deterministic_from_the_anchor_and_interval()
    {
        var series = Series(new DateOnly(2026, 8, 30));
        series.IntervalWeeks = 2;

        var dates = EventSeriesPolicy.OccurrenceDates(series, new DateOnly(2026, 9, 1), 8);

        Assert.Equal([new DateOnly(2026, 9, 13), new DateOnly(2026, 9, 27), new DateOnly(2026, 10, 11), new DateOnly(2026, 10, 25)], dates);
    }

    [Fact]
    public async Task Series_settings_are_private_to_group_leaders()
    {
        await using var db = CreateDbContext();
        var series = Series(new DateOnly(2026, 8, 30));
        db.EventSeries.Add(series);
        await db.SaveChangesAsync();
        var authorization = Substitute.For<IGroupAuthorizationService>();

        var list = await new ListEventSeriesQueryHandler(db, authorization).Handle(
            new ListEventSeriesQuery(series.GroupId, Guid.NewGuid()), CancellationToken.None);
        var generate = await new GenerateEventSeriesInstancesCommandHandler(
            db, authorization, Substitute.For<IEventCacheInvalidationService>()).Handle(
            new GenerateEventSeriesInstancesCommand(series.Id, Guid.NewGuid(), series.AnchorLocalDate, 8), CancellationToken.None);

        Assert.Equal(AppResultStatus.Forbidden, list.Status);
        Assert.Equal(AppResultStatus.Forbidden, generate.Status);
    }

    [Fact]
    public async Task Leader_can_save_a_bilingual_series_without_generating_an_event()
    {
        await using var db = CreateDbContext();
        var leaderId = Guid.NewGuid();
        var groupId = Guid.NewGuid();
        var authorization = LeaderAuthorization(groupId, leaderId);
        var handler = new SaveEventSeriesCommandHandler(db, authorization);

        var result = await handler.Handle(new SaveEventSeriesCommand(
            null, groupId, leaderId, "Sunday gathering", "", "Weekly worship", "",
            "UTC", new DateOnly(2026, 8, 30), 600, 90, 1, 8, 4,
            EventVisibilityPolicy.ChurchVisible, ["roster", "roster", "finance"], true), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal("Sunday gathering", result.Value!.Name.Zh);
        Assert.Equal(["finance", "roster"], result.Value.DefaultModules);
        Assert.Empty(await db.GroupEvents.ToListAsync());
        Assert.Contains(await db.AuditLogs.ToListAsync(), x => x.Action == "event-series.created");
    }

    [Fact]
    public async Task Explicit_generation_creates_real_draft_events_once_and_preserves_per_event_workflows()
    {
        await using var db = CreateDbContext();
        var leaderId = Guid.NewGuid();
        var series = Series(new DateOnly(2026, 8, 30), leaderId);
        series.DefaultModulesJson = EventSeriesPolicy.SerializeModules(["finance", "roster"]);
        db.EventSeries.Add(series);
        await db.SaveChangesAsync();
        var authorization = LeaderAuthorization(series.GroupId, leaderId);
        var cache = Substitute.For<IEventCacheInvalidationService>();
        cache.RemoveGroupEventsAsync(series.GroupId, Arg.Any<CancellationToken>()).Returns(Task.CompletedTask);
        var handler = new GenerateEventSeriesInstancesCommandHandler(db, authorization, cache);

        var first = await handler.Handle(new GenerateEventSeriesInstancesCommand(
            series.Id, leaderId, series.AnchorLocalDate, 8), CancellationToken.None);
        var second = await handler.Handle(new GenerateEventSeriesInstancesCommand(
            series.Id, leaderId, series.AnchorLocalDate, 8), CancellationToken.None);

        Assert.True(first.IsSuccess);
        Assert.Equal(8, first.Value!.CreatedCount);
        Assert.Equal(0, first.Value.ExistingCount);
        Assert.True(second.IsSuccess);
        Assert.Equal(0, second.Value!.CreatedCount);
        Assert.Equal(8, second.Value.ExistingCount);
        var events = await db.GroupEvents.Include(x => x.Plan).ThenInclude(x => x!.Modules).OrderBy(x => x.StartDate).ToListAsync();
        Assert.Equal(8, events.Count);
        Assert.All(events, groupEvent =>
        {
            Assert.Equal(series.Id, groupEvent.EventSeriesId);
            Assert.NotNull(groupEvent.SeriesOccurrenceDate);
            using var document = JsonDocument.Parse(groupEvent.EventDataJson);
            Assert.Equal("draft", document.RootElement.GetProperty("publicationStatus").GetString());
            Assert.Contains(groupEvent.Plan!.Modules, x => x.ModuleKey == "finance" && x.IsRequired);
            Assert.Contains(groupEvent.Plan.Modules, x => x.ModuleKey == "roster" && x.IsRequired);
        });
        await cache.Received(2).RemoveGroupEventsAsync(series.GroupId, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Updating_series_defaults_does_not_rewrite_already_generated_events()
    {
        await using var db = CreateDbContext();
        var leaderId = Guid.NewGuid();
        var series = Series(new DateOnly(2026, 8, 30), leaderId);
        series.DefaultModulesJson = EventSeriesPolicy.SerializeModules(["venue"]);
        db.EventSeries.Add(series);
        await db.SaveChangesAsync();
        var authorization = LeaderAuthorization(series.GroupId, leaderId);
        var cache = Substitute.For<IEventCacheInvalidationService>();
        cache.RemoveGroupEventsAsync(series.GroupId, Arg.Any<CancellationToken>()).Returns(Task.CompletedTask);
        await new GenerateEventSeriesInstancesCommandHandler(db, authorization, cache).Handle(
            new GenerateEventSeriesInstancesCommand(series.Id, leaderId, series.AnchorLocalDate, 1), CancellationToken.None);
        var generated = await db.GroupEvents.AsNoTracking().SingleAsync();

        await new SaveEventSeriesCommandHandler(db, authorization).Handle(new SaveEventSeriesCommand(
            series.Id, series.GroupId, leaderId, series.NameEn, series.NameZh, series.DescriptionEn, series.DescriptionZh,
            series.TimeZoneId, series.AnchorLocalDate, series.StartTimeMinutes, series.DurationMinutes,
            series.IntervalWeeks, series.GenerationHorizonWeeks, series.LowHorizonWeeks,
            series.Visibility, ["finance"], true), CancellationToken.None);

        using var originalFacts = JsonDocument.Parse(generated.EventDataJson);
        Assert.Equal("venue", originalFacts.RootElement.GetProperty("enabledModules")[0].GetString());
    }

    private static EventSeries Series(DateOnly anchor, Guid? leaderId = null) => new()
    {
        Id = Guid.NewGuid(), GroupId = Guid.NewGuid(), CreatedByMemberId = leaderId ?? Guid.NewGuid(),
        NameEn = "Sunday gathering", NameZh = "主日聚会", DescriptionEn = "Weekly worship", DescriptionZh = "每周敬拜",
        TimeZoneId = "UTC", AnchorLocalDate = anchor, Weekday = anchor.DayOfWeek,
        StartTimeMinutes = 600, DurationMinutes = 90, IntervalWeeks = 1,
        GenerationHorizonWeeks = 8, LowHorizonWeeks = 4,
        Visibility = EventVisibilityPolicy.ChurchVisible, DefaultModulesJson = "[]", IsActive = true,
        CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
    };

    private static IGroupAuthorizationService LeaderAuthorization(Guid groupId, Guid leaderId)
    {
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(groupId, leaderId, Arg.Any<CancellationToken>()).Returns(true);
        return authorization;
    }

    private static AlifeDbContext CreateDbContext() => new(new DbContextOptionsBuilder<AlifeDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
}
