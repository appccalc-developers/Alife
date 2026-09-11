using Alife.Application.Common.Models;
using Alife.Application.Events.Commands.UpdateGroupEvent;
using Alife.Application.Events.Composition;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.Events;

public sealed partial class EventPackageFoundationTests
{
    [Theory]
    [InlineData("outdoor-activity", "simple-social")]
    [InlineData("shared-meal", "recurring-gathering")]
    public async Task SavedPreparation_CannotSwitchTemplateThroughPreviewOrAcceptance(string template, string archetype)
    {
        await using var db = CreateDb();
        var seed = await SeedAsync(db, false, ["TEAM.WORK"]);
        var input = new EventPlanComposeRequest("1.1.0", archetype, new([]), [], seed.Plan.PlanVersion, template);
        var auth = Authorization(); var engine = new EventCompositionEngine();
        var preview = await new RecomposeEventPlanCommandHandler(db, auth, engine).Handle(new(seed.Event.Id, seed.Owner, input, seed.Plan.ETag), default);
        Assert.Equal(AppResultStatus.Conflict, preview.Status);
        Assert.Equal(EventPreparationPolicy.TemplateLockedMessage, preview.Message);
        var accept = await new AcceptEventPlanCommandHandler(db, auth, engine, Substitute.For<IEventCacheInvalidationService>(), new EventPackageInvalidationService(db))
            .Handle(new(seed.Event.Id, seed.Owner, new(seed.Plan.Plan.ProposalHash, [], input), seed.Plan.ETag, "switch-template"), default);
        Assert.Equal(AppResultStatus.Conflict, accept.Status);
        Assert.Equal(EventPreparationPolicy.TemplateLockedMessage, accept.Message);
        Assert.Single(await db.EventPlanSnapshots.ToListAsync());
    }

    [Fact]
    public async Task SharedDetailsForm_UpdatesRecurrence_PreservingExceptionsAndExistingOccurrences()
    {
        await using var db = CreateDb();
        var seed = await SeedAsync(db, true, ["TEAM.WORK"]);
        seed.Event.PublicationStatus = EventPublicationStatus.Draft;
        var series = await db.EventSeries.SingleAsync();
        series.ExceptionDatesJson = "[\"2026-10-18\"]";
        await db.SaveChangesAsync();
        var arrangements = await EventPreparationArrangements.ReadAsync(db, seed.Event.Id, seed.Occurrences[0].Id, default);
        var source = arrangements.Value!.Series!;
        Assert.Single(source.ExceptionDates);
        var seriesEdit = new UpdateEventSeriesRequest(new("Gathering", "聚会"), "FREQ=WEEKLY;INTERVAL=2", "Pacific/Auckland",
            new DateTime(2026, 10, 4, 18, 0, 0), 120, source.ExceptionDates, source.RollingOccurrenceWeeks);
        var result = await new UpdateGroupEventCommandHandler(db, Authorization(), Substitute.For<IEventCacheInvalidationService>(), new EventPackageInvalidationService(db))
            .Handle(new(seed.Event.Id, seed.Owner, "Revised", "已修改", seed.Event.StartDate, seed.Event.EndDate,
                "{\"visibility\":\"groupVisible\",\"timeZone\":\"Pacific/Auckland\"}", IfMatch: seed.Event.UpdatedUtc.ToString("O"),
                SeriesUpdate: new(source.ETag, seriesEdit)), default);
        Assert.True(result.IsSuccess, result.Message);
        db.ChangeTracker.Clear();
        Assert.Equal("FREQ=WEEKLY;INTERVAL=2", (await db.EventSeries.SingleAsync()).RecurrenceRule);
        foreach (var occurrence in seed.Occurrences) Assert.True(await db.EventOccurrences.AnyAsync(x => x.Id == occurrence.Id && x.StartUtc == occurrence.StartUtc));
        Assert.False(await db.EventOccurrences.AnyAsync(x => x.LocalDate == new DateOnly(2026, 10, 18)));
        Assert.True(await db.EventOccurrences.CountAsync() > seed.Occurrences.Length);
        Assert.Equal("Revised", (await db.GroupEvents.SingleAsync()).TitleEn);
    }

    [Fact]
    public async Task ApprovedPreparation_RejectsDirectSeriesChanges()
    {
        await using var db = CreateDb();
        var seed = await SeedAsync(db, true, ["TEAM.WORK"]);
        db.EventPackages.Add(new EventPackage { Id = Guid.NewGuid(), EventId = seed.Event.Id,
            Status = EventPackageStatus.Approved, ApprovalValidityStatus = EventPackageApprovalValidity.Active });
        await db.SaveChangesAsync();
        var source = (await EventPreparationArrangements.ReadAsync(db, seed.Event.Id, null, default)).Value!.Series!;
        var auth = Authorization();
        auth.IsLeaderOrCoLeaderAsync(seed.Event.GroupId, seed.Owner, Arg.Any<CancellationToken>()).Returns(true);
        var result = await new UpdateEventSeriesCommandHandler(db, auth).Handle(new(source.Id, seed.Owner,
            new(new("Changed", "修改"), "FREQ=WEEKLY;INTERVAL=2", "Pacific/Auckland", new DateTime(2026, 10, 4, 18, 0, 0), 120), source.ETag), default);
        Assert.Equal(AppResultStatus.Conflict, result.Status);
        Assert.Equal("FREQ=WEEKLY", (await db.EventSeries.SingleAsync()).RecurrenceRule);
        Assert.Equal(seed.Occurrences.Length, await db.EventOccurrences.CountAsync());
    }
}
