using Alife.Application.Common.Models;
using Alife.Application.Events.Composition;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.Events;

public partial class EventCreationArrangementsTests
{
    [Fact]
    public async Task SavedForm_AcceptsPlanAndRowsTogether_IdempotentlyPreservingOperationalIdentity()
    {
        await using var db = Database();
        var created = await Handler(db).Handle(Command(Details()), default);
        Assert.True(created.IsSuccess, created.Message);
        var id = created.Value!.Id;
        var session = await db.EventSessions.Include(x => x.ProgramItems).SingleAsync();
        var item = session.ProgramItems.Single();
        session.LeadMemberId = actorId; session.PlaceJson = "{\"room\":\"A\"}";
        item.OwnerMemberId = actorId; item.ContentJson = "{\"notes\":\"private\"}";
        var slot = await db.EventServiceSlots.SingleAsync();
        slot.SessionId = session.Id; slot.ProgramItemId = item.Id;
        var assignment = new EventRosterAssignment { Id = Guid.NewGuid(), ServiceSlotId = slot.Id, MemberId = actorId };
        db.EventRosterAssignments.Add(assignment);
        await db.SaveChangesAsync();
        var rows = (await EventPreparationArrangements.ReadAsync(db, id, null, default)).Value!;
        Assert.Equal(50, rows.VenueBookings[0].Venue!.Capacity);
        Assert.Equal("Hall", rows.VenueBookings[0].Venue!.Name.En);
        var updated = new SavePreparationArrangementsRequest(rows.OccurrenceId, rows.ETag,
            [rows.ServiceSlots[0] with { Details = rows.ServiceSlots[0].Details with { RequiredCount = 4 } }],
            [rows.Sessions[0] with { Details = rows.Sessions[0].Details with { Title = Text("Opening", "开场") } }],
            [rows.VenueBookings[0] with { Details = rows.VenueBookings[0].Details with { RequiredCapacity = 35 } }]);
        var auth = Substitute.For<IGroupAuthorizationService>();
        var engine = new EventCompositionEngine();
        var snapshot = EventCompositionPersistence.ToSnapshotDto(await db.EventPlanSnapshots.SingleAsync());
        var input = Command(null).Composition! with { BasePlanVersion = snapshot.PlanVersion };
        var proposal = await new RecomposeEventPlanCommandHandler(db, auth, engine).Handle(new(id, actorId, input, snapshot.ETag), default);
        Assert.True(proposal.IsSuccess, proposal.Message);
        var accept = new AcceptEventPlanCommandHandler(db, auth, engine,
            Substitute.For<IEventCacheInvalidationService>(), new EventPackageInvalidationService(db));
        var command = new AcceptEventPlanCommand(id, actorId, new(proposal.Value!.ProposalHash, [], input, updated), snapshot.ETag, "saved-arrangements");
        var accepted = await accept.Handle(command, default);
        Assert.True(accepted.IsSuccess, accepted.Message);
        Assert.True((await accept.Handle(command, default)).IsSuccess);
        db.ChangeTracker.Clear();
        Assert.Equal(2, await db.EventPlanSnapshots.CountAsync());
        var savedSlot = await db.EventServiceSlots.SingleAsync();
        Assert.Equal(slot.Id, savedSlot.Id); Assert.Equal(4, savedSlot.RequiredCount); Assert.Equal(item.Id, savedSlot.ProgramItemId);
        Assert.Equal(assignment.Id, (await db.EventRosterAssignments.SingleAsync()).Id);
        var savedSession = await db.EventSessions.SingleAsync();
        Assert.Equal(session.Id, savedSession.Id); Assert.Equal("Opening", savedSession.TitleEn);
        Assert.Equal(actorId, savedSession.LeadMemberId); Assert.Equal(session.PlaceJson, savedSession.PlaceJson);
        var savedItem = await db.EventProgramItems.SingleAsync();
        Assert.Equal(item.Id, savedItem.Id); Assert.Equal(item.ContentJson, savedItem.ContentJson); Assert.Equal(actorId, savedItem.OwnerMemberId);
        var booking = await db.EventVenueReservations.SingleAsync();
        Assert.Equal(rows.VenueBookings[0].Id, booking.Id); Assert.Equal(35, booking.RequiredCapacity);
        Assert.Single(await db.EventVenues.ToListAsync());
        Assert.NotEqual(rows.ETag, (await EventPreparationArrangements.ReadAsync(db, id, null, default)).Value!.ETag);
    }

    [Theory]
    [InlineData("etag", AppResultStatus.PreconditionFailed)]
    [InlineData("foreign-row", AppResultStatus.ValidationError)]
    [InlineData("foreign-occurrence", AppResultStatus.ValidationError)]
    [InlineData("remove-response", AppResultStatus.Conflict)]
    [InlineData("linked-session", AppResultStatus.Conflict)]
    [InlineData("omit-arrays", AppResultStatus.Success)]
    public async Task SavedRows_RejectStaleOrForeignData_AndPreserveHistory(string scenario, AppResultStatus expected)
    {
        await using var db = Database();
        var created = await Handler(db).Handle(Command(Details()), default);
        var groupEvent = await db.GroupEvents.SingleAsync();
        var slot = await db.EventServiceSlots.SingleAsync();
        var session = await db.EventSessions.SingleAsync();
        if (scenario == "remove-response") db.EventRosterAssignments.Add(new() { Id = Guid.NewGuid(), ServiceSlotId = slot.Id, MemberId = actorId });
        if (scenario == "linked-session") slot.SessionId = session.Id;
        await db.SaveChangesAsync();
        var rows = (await EventPreparationArrangements.ReadAsync(db, created.Value!.Id, null, default)).Value!;
        var request = new SavePreparationArrangementsRequest(rows.OccurrenceId, rows.ETag);
        request = scenario switch {
            "etag" => request with { ETag = "stale" },
            "foreign-row" => request with { ServiceSlots = [rows.ServiceSlots[0] with { Id = Guid.NewGuid() }] },
            "foreign-occurrence" => request with { OccurrenceId = Guid.NewGuid() },
            "remove-response" => request with { ServiceSlots = [] },
            "linked-session" => request with { Sessions = [] },
            _ => request
        };
        var plan = EventCompositionPersistence.ToSnapshotDto(await db.EventPlanSnapshots.SingleAsync()).Plan;
        var result = await EventPreparationArrangements.ApplyAsync(db, groupEvent, actorId, plan, request, DateTime.UtcNow, default);
        Assert.Equal(expected, result.Status);
        if (result.IsSuccess) await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        Assert.Equal(slot.Id, (await db.EventServiceSlots.SingleAsync()).Id);
        Assert.Equal(EventSessionStatus.Draft, (await db.EventSessions.SingleAsync()).Status);
        Assert.Single(await db.EventProgramItems.ToListAsync()); Assert.Single(await db.EventVenueReservations.ToListAsync());
    }
}
