using Alife.Application.Common.Models;
using Alife.Application.Events.Commands.UpdateEventOccurrences;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.Events;

public sealed class EventOccurrenceWorkflowTests
{
    [Fact]
    public async Task Leader_can_define_multiple_sessions_and_schedule_change_invalidates_old_confirmations()
    {
        await using var db = CreateDbContext();
        var leader = Member();
        var groupEvent = Event(leader.Id);
        groupEvent.Plan = EventCompositionFactory.CreateInitial(groupEvent, leader.Id, null, DateTime.UtcNow);
        groupEvent.RamAssessment = new EventRamAssessment
        {
            EventId = groupEvent.Id, RamDataJson = "{\"leaderConfirmed\":true}", Status = EventRamStatus.Approved,
            ApprovedByMemberId = leader.Id, ApprovedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
        };
        groupEvent.ClosureReport = new EventClosureReport
        {
            EventId = groupEvent.Id, SummaryEn = "Done", SummaryZh = "完成", AttendanceNotes = "10",
            FinanceNotes = "None", IncidentNotes = "None", FollowUpNotes = "Done", ReusableLearningsJson = "[]",
            LeaderConfirmed = true, ConfirmedByMemberId = leader.Id, ConfirmedUtc = DateTime.UtcNow,
            CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
        };
        db.AddRange(leader, groupEvent);
        await db.SaveChangesAsync();
        var main = groupEvent.Plan.Occurrences.Single();
        var handler = Handler(db, groupEvent.GroupId, leader.Id);

        var result = await handler.Handle(new UpdateEventOccurrencesCommand(groupEvent.Id, leader.Id, [
            new(main.Id, "Welcome", "欢迎", groupEvent.StartDate, groupEvent.StartDate.AddHours(1), "Pacific/Auckland"),
            new(null, "Dinner", "晚餐", groupEvent.StartDate.AddHours(2), groupEvent.StartDate.AddHours(4), "Pacific/Auckland")
        ]), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(2, result.Value!.Count);
        Assert.Equal(2, groupEvent.Plan.CurrentRevision);
        Assert.Equal(EventRamStatus.Draft, groupEvent.RamAssessment.Status);
        Assert.False(groupEvent.ClosureReport.LeaderConfirmed);
        Assert.Contains(await db.AuditLogs.ToListAsync(), x => x.Action == "event.occurrences.updated");
    }

    [Fact]
    public async Task Session_must_stay_inside_the_event_envelope()
    {
        await using var db = CreateDbContext();
        var leader = Member();
        var groupEvent = Event(leader.Id);
        groupEvent.Plan = EventCompositionFactory.CreateInitial(groupEvent, leader.Id, null, DateTime.UtcNow);
        db.AddRange(leader, groupEvent);
        await db.SaveChangesAsync();

        var result = await Handler(db, groupEvent.GroupId, leader.Id).Handle(
            new UpdateEventOccurrencesCommand(groupEvent.Id, leader.Id, [
                new(groupEvent.Plan.Occurrences.Single().Id, "Outside", "超出范围",
                    groupEvent.StartDate.AddHours(-1), groupEvent.StartDate.AddHours(1), "Pacific/Auckland")
            ]), CancellationToken.None);

        Assert.Equal(AppResultStatus.ValidationError, result.Status);
    }

    [Fact]
    public async Task Session_with_a_venue_request_cannot_be_removed()
    {
        await using var db = CreateDbContext();
        var leader = Member();
        var groupEvent = Event(leader.Id);
        groupEvent.Plan = EventCompositionFactory.CreateInitial(groupEvent, leader.Id, null, DateTime.UtcNow);
        db.AddRange(leader, groupEvent);
        await db.SaveChangesAsync();
        var main = groupEvent.Plan.Occurrences.Single();
        var handler = Handler(db, groupEvent.GroupId, leader.Id);
        var added = await handler.Handle(new UpdateEventOccurrencesCommand(groupEvent.Id, leader.Id, [
            new(main.Id, "Welcome", "欢迎", groupEvent.StartDate, groupEvent.StartDate.AddHours(1), "Pacific/Auckland"),
            new(null, "Dinner", "晚餐", groupEvent.StartDate.AddHours(2), groupEvent.StartDate.AddHours(4), "Pacific/Auckland")
        ]), CancellationToken.None);
        var dinner = added.Value!.Single(x => x.Name.En == "Dinner");
        db.EventVenueBookings.Add(new EventVenueBooking
        {
            Id = Guid.NewGuid(), EventId = groupEvent.Id, EventOccurrenceId = dinner.Id,
            VenueSpaceId = Guid.NewGuid(), RequestedByMemberId = leader.Id,
            PurposeEn = "Dinner", PurposeZh = "晚餐", Notes = "", DecisionNotes = "",
            StartUtc = dinner.StartUtc, EndUtc = dinner.EndUtc, AttendeeCount = 20,
            Status = VenueBookingStatus.Draft, CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var result = await handler.Handle(new UpdateEventOccurrencesCommand(groupEvent.Id, leader.Id, [
            new(main.Id, "Welcome", "欢迎", groupEvent.StartDate, groupEvent.StartDate.AddHours(1), "Pacific/Auckland")
        ]), CancellationToken.None);

        Assert.Equal(AppResultStatus.Conflict, result.Status);
    }

    private static UpdateEventOccurrencesCommandHandler Handler(AlifeDbContext db, Guid groupId, Guid leaderId)
    {
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(groupId, leaderId, Arg.Any<CancellationToken>()).Returns(true);
        var cache = Substitute.For<IEventCacheInvalidationService>();
        cache.RemoveGroupEventsAsync(groupId, Arg.Any<CancellationToken>()).Returns(Task.CompletedTask);
        return new UpdateEventOccurrencesCommandHandler(db, authorization, cache);
    }

    private static AlifeDbContext CreateDbContext() => new(new DbContextOptionsBuilder<AlifeDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private static GroupEvent Event(Guid leaderId)
    {
        var start = DateTime.UtcNow.AddDays(5);
        return new GroupEvent
        {
            Id = Guid.NewGuid(), GroupId = Guid.NewGuid(), CreatedByMemberId = leaderId,
            TitleEn = "Family camp", TitleZh = "家庭营会", StartDate = start, EndDate = start.AddDays(3),
            EventDataJson = "{\"visibility\":\"groupVisible\",\"timeZoneId\":\"Pacific/Auckland\"}",
            CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
        };
    }

    private static Member Member() => new()
    {
        Id = Guid.NewGuid(), DisplayName = "Leader", IsRegistered = true,
        CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
    };
}
