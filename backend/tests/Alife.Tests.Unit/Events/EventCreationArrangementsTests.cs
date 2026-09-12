using Alife.Application.Common.Models;
using Alife.Application.Events.Commands.CreateGroupEvent;
using Alife.Application.Events.Composition;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.Events;

public partial class EventCreationArrangementsTests
{
    private readonly Guid groupId = Guid.NewGuid(), actorId = Guid.NewGuid();
    private static readonly DateTime Start = new(2026, 9, 20, 7, 0, 0, DateTimeKind.Utc);
    private static LocalizedTextDto Text(string en = "Welcome", string zh = "欢迎") => new(en, zh);
    private static EventCreationArrangementsRequest Details() => new(
        [new("welcome", 3, "approvedGroupMember", -15, 120)],
        [new(Text(), 0, 120, [new(Text(), Text("Private programme notes", "团队节目说明"), 10, 20)])],
        [new(null, null, new(Text("Hall", "礼堂"), Text("Address", "地址"), 50, true), 30, -30, 150)]);
    private static AlifeDbContext Database() => new(new DbContextOptionsBuilder<AlifeDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
    private CreateGroupEventCommandHandler Handler(AlifeDbContext db, bool allowed = true)
    {
        var auth = Substitute.For<IGroupAuthorizationService>();
        auth.IsLeaderOrCoLeaderAsync(groupId, actorId, Arg.Any<CancellationToken>()).Returns(allowed);
        return new(db, auth, Substitute.For<IEventCacheInvalidationService>(), new EventCompositionEngine());
    }
    private CreateGroupEventCommand Command(EventCreationArrangementsRequest? details, bool enabled = true, bool series = false)
    {
        var composition = new EventPlanComposeRequest(EventCompositionDefinitions.SchemaVersion,
            series ? "recurring-gathering" : "simple-social", new EventFactSetInput([]),
            new[] { "SERVICE.ROSTER", "PROGRAM.PRODUCTION", "PLACE.RESOURCE" }.Select(code => new ModuleSelectionInput(code, enabled)).ToArray(),
            null, series ? "small-group-fellowship" : "shared-meal", false);
        var plan = new EventCompositionEngine().Compose(composition, new EventCompositionContext("\"plan-new\"", HasAccountableOwner: true));
        Assert.True(plan.IsSuccess);
        return new(groupId, actorId, "Meal", "聚餐", Start, Start.AddHours(2), "{\"visibility\":\"groupVisible\"}",
            Composition: composition, CompositionProposalHash: plan.Value!.ProposalHash, IdempotencyKey: "arrange-once", Arrangements: details);
    }

    [Fact]
    public async Task InlineRam_IsSavedAtomically_RecalculatesScores_AndRemainsPrivateDraftOnRetry()
    {
        await using var db = Database(); var handler = Handler(db);
        var command = Command(Details()) with { RamDataJson = """
            {"schemaVersion":2,"activities":[{"id":"walk","type":"hiking","name":{"en":"Walk","zh":"步行"}}],
             "hazards":[{"id":"slip","activityId":"walk","categoryCode":"environment","hazard":{"en":"Private hazard","zh":"私人风险"},
             "likelihood":2,"impact":3,"riskScore":1,"initialLevel":"Green","residualLikelihood":1,"residualImpact":2,"residualScore":1,"residualLevel":"Green"}],"answers":[]}
            """ };
        var result = await handler.Handle(command, default);
        Assert.True(result.IsSuccess);
        var retry = await handler.Handle(command, default);
        Assert.Equal(result.Value!.Id, retry.Value!.Id);
        Assert.Single(await db.GroupEvents.ToListAsync());
        var ram = await db.EventRamAssessments.SingleAsync();
        Assert.Equal(2, ram.SchemaVersion); Assert.Equal("Draft", ram.Validity);
        Assert.Equal(actorId, ram.AuthorMemberId); Assert.Null(ram.PolicyVersionId);
        Assert.Equal(EventRamStatus.Draft, ram.Status); Assert.Null(ram.ApprovedUtc); Assert.Null(ram.CurrentRevisionId);
        Assert.Equal("Incomplete", ram.ResidualLevel);
        var draft = RamEvaluator.Parse(ram.RamDataJson);
        Assert.Equal(6, draft.Hazards[0].RiskScore); Assert.Equal(2, draft.Hazards[0].ResidualScore);
        Assert.DoesNotContain("Private hazard", (await db.GroupEvents.SingleAsync()).EventDataJson);
        Assert.Empty(await db.EventRamRevisions.ToListAsync());
        var changed = command with { RamDataJson = command.RamDataJson.Replace("Private hazard", "Different hazard") };
        Assert.Equal(AppResultStatus.Conflict, (await handler.Handle(changed, default)).Status);
    }

    [Fact]
    public async Task VersionedRamWithoutComposition_DoesNotUseImplicitPublication()
    {
        await using var db = Database();
        var command = Command(null) with { Composition = null, CompositionProposalHash = null, IdempotencyKey = null, RamDataJson = "{\"schemaVersion\":2}" };
        Assert.True((await Handler(db).Handle(command, default)).IsSuccess);
        var item = await db.GroupEvents.SingleAsync();
        Assert.Equal(EventPublicationStatus.Draft, item.PublicationStatus);
        Assert.Equal(EventRegistrationStatus.Closed, item.RegistrationStatus);
    }

    [Theory]
    [InlineData("{\"schemaVersion\":2,\"activities\":null}")]
    [InlineData("{\"schemaVersion\":3}")]
    public async Task InvalidInlineRam_LeavesNoPartialEvent(string json)
    {
        await using var db = Database();
        var result = await Handler(db).Handle(Command(Details()) with { RamDataJson = json }, default);
        Assert.Equal(AppResultStatus.ValidationError, result.Status);
        Assert.Empty(await db.GroupEvents.ToListAsync()); Assert.Empty(await db.EventRamAssessments.ToListAsync());
    }

    [Fact]
    public async Task Create_PersistsAllDetailsOnce_OverridesPresets_AndKeepsPrivateNotesOutOfPublicJson()
    {
        await using var db = Database(); var handler = Handler(db); var command = Command(Details());
        var created = await handler.Handle(command, default);
        var retry = await handler.Handle(command, default);
        Assert.True(created.IsSuccess); Assert.Equal(created.Value!.Id, retry.Value!.Id);
        Assert.Equal(EventPublicationStatus.Draft, created.Value.PublicationStatus);
        Assert.False(created.Value.PublicationGateSatisfied);
        Assert.False(EventVisibilityPolicy.IsPublished(created.Value with { RamStatus = EventRamStatus.Approved }));
        Assert.Equal(EventRegistrationStatus.Closed, (await db.GroupEvents.SingleAsync()).RegistrationStatus);
        Assert.Single(await db.GroupEvents.ToListAsync());
        var slot = await db.EventServiceSlots.SingleAsync();
        Assert.Equal(3, slot.RequiredCount); Assert.Equal(Start.AddMinutes(-15), slot.StartUtc);
        Assert.Single(await db.EventSessions.ToListAsync());
        Assert.Equal("Private programme notes", (await db.EventProgramItems.SingleAsync()).DescriptionEn);
        Assert.Single(await db.EventVenues.ToListAsync());
        Assert.Equal(30, (await db.EventVenueReservations.SingleAsync()).RequiredCapacity);
        Assert.Empty(await db.EventRosterAssignments.ToListAsync());
        Assert.DoesNotContain("Private programme notes", (await db.GroupEvents.SingleAsync()).EventDataJson);
        var changed = command with { Arrangements = Details() with { ServiceSlots = [new("welcome", 4, "approvedGroupMember", 0, 120)] } };
        Assert.Equal(AppResultStatus.Conflict, (await handler.Handle(changed, default)).Status);
        Assert.Equal(3, (await db.EventServiceSlots.SingleAsync()).RequiredCount);
    }

    [Fact]
    public async Task CreationRetry_UsesSameEventAndCurrentPublicationState()
    {
        await using var db = Database(); var handler = Handler(db); var command = Command(Details());
        var created = await handler.Handle(command, default); var item = await db.GroupEvents.SingleAsync();
        item.PublicationStatus = EventPublicationStatus.Published;
        item.PublicationGateMode = EventPackageEnforcementMode.Off;
        await db.SaveChangesAsync();
        var retry = await handler.Handle(command, default);
        Assert.Equal(created.Value!.Id, retry.Value!.Id);
        Assert.Equal(EventPublicationStatus.Published, retry.Value.PublicationStatus);
        Assert.True(retry.Value.PublicationGateSatisfied);
        item.PublicationStatus = EventPublicationStatus.Unpublished; await db.SaveChangesAsync();
        Assert.False((await handler.Handle(command, default)).Value!.PublicationGateSatisfied);
        Assert.Single(await db.GroupEvents.ToListAsync());
    }

    [Fact]
    public async Task LegacyCreationWithoutComposition_RetainsImplicitLifecycleCompatibility()
    {
        await using var db = Database(); var command = Command(null) with { Composition = null, CompositionProposalHash = null, IdempotencyKey = null };
        var result = await Handler(db).Handle(command, default);
        Assert.True(result.IsSuccess);
        Assert.Equal(EventPublicationStatus.LegacyImplicit, result.Value!.PublicationStatus);
        Assert.Equal(EventRegistrationStatus.LegacyImplicit, (await db.GroupEvents.SingleAsync()).RegistrationStatus);
    }

    [Theory]
    [InlineData("disabled")]
    [InlineData("capacity")]
    [InlineData("programme")]
    [InlineData("notes")]
    [InlineData("count")]
    [InlineData("null-session")]
    [InlineData("unauthorized")]
    public async Task InvalidDetails_LeaveNoPartialEventOrOperationalRows(string failure)
    {
        await using var db = Database(); var details = Details();
        if (failure == "capacity") details = details with { VenueBookings = [details.VenueBookings![0] with { RequiredCapacity = 51 }] };
        if (failure == "programme") details = details with { Sessions = [details.Sessions![0] with { EndOffsetMinutes = 20 }] };
        if (failure == "notes") details = details with { Sessions = [details.Sessions![0] with { Items = [new(Text(), Text(new string('x', 2001)), 0, 10)] }] };
        if (failure == "count") details = details with { ServiceSlots = [details.ServiceSlots![0] with { RequiredCount = 0 }] };
        if (failure == "null-session") details = details with { Sessions = [null!] };
        var result = await Handler(db, failure != "unauthorized").Handle(Command(details, failure != "disabled"), default);
        Assert.False(result.IsSuccess);
        Assert.Empty(await db.GroupEvents.ToListAsync()); Assert.Empty(await db.EventOccurrences.ToListAsync());
        Assert.Empty(await db.EventServiceSlots.ToListAsync()); Assert.Empty(await db.EventSessions.ToListAsync());
        Assert.Empty(await db.EventVenues.ToListAsync()); Assert.Empty(await db.EventVenueReservations.ToListAsync());
        Assert.Empty(await db.EventIdempotencyRecords.ToListAsync());
    }

    [Theory]
    [InlineData("overlap", AppResultStatus.Conflict)]
    [InlineData("stale", AppResultStatus.PreconditionFailed)]
    [InlineData("foreign", AppResultStatus.ValidationError)]
    [InlineData("inactive", AppResultStatus.ValidationError)]
    [InlineData("touching", AppResultStatus.Success)]
    public async Task ExistingVenue_EnforcesGroupStatusETagAndHalfOpenBookingIntervals(string scenario, AppResultStatus expected)
    {
        await using var db = Database();
        var venue = new EventVenue { Id = Guid.NewGuid(), ManagingGroupId = scenario == "foreign" ? Guid.NewGuid() : groupId,
            NameEn = "Hall", NameZh = "礼堂", Capacity = 50, IsActive = scenario != "inactive", ConcurrencyToken = Guid.NewGuid() };
        db.EventVenues.Add(venue);
        db.EventVenueReservations.Add(new() { Id = Guid.NewGuid(), VenueId = venue.Id, EventId = Guid.NewGuid(),
            StartUtc = Start.AddHours(-2), EndUtc = scenario == "touching" ? Start : Start.AddMinutes(1),
            Status = EventVenueReservationStatus.Confirmed, RequiredCapacity = 1 });
        await db.SaveChangesAsync(); var previousToken = venue.ConcurrencyToken;
        var booking = new EventCreationVenueRequest(venue.Id, scenario == "stale" ? "old" : $"\"venue-{previousToken:N}\"", null, 30, 0, 120);
        var result = await Handler(db).Handle(Command(Details() with { VenueBookings = [booking] }), default);
        Assert.Equal(expected, result.Status);
        Assert.Equal(scenario == "touching" ? 1 : 0, await db.GroupEvents.CountAsync());
        Assert.Equal(scenario == "touching" ? 2 : 1, await db.EventVenueReservations.CountAsync());
        Assert.Equal(scenario != "touching", venue.ConcurrencyToken == previousToken);
    }

    [Fact]
    public async Task RecurringDetails_AreRelativeToEachMaterializedOccurrence()
    {
        await using var db = Database(); var firstLocal = DateTime.SpecifyKind(DateTime.Today.AddDays(1).AddHours(19), DateTimeKind.Unspecified);
        var weekday = new[] { "SU", "MO", "TU", "WE", "TH", "FR", "SA" }[(int)firstLocal.DayOfWeek];
        var command = Command(Details(), series: true) with { SeriesSetup = new(Text(), $"FREQ=WEEKLY;INTERVAL=1;BYDAY={weekday}", "Pacific/Auckland", firstLocal, 120, [], 12) };
        Assert.True((await Handler(db).Handle(command, default)).IsSuccess);
        var occurrences = await db.EventOccurrences.ToListAsync(); Assert.True(occurrences.Count > 1);
        Assert.Equal(occurrences.Count, await db.EventVenueReservations.CountAsync());
        Assert.Equal(occurrences.Count, await db.EventProgramItems.CountAsync());
        foreach (var occurrence in occurrences)
        {
            Assert.Equal(occurrence.StartUtc.AddMinutes(-15), (await db.EventServiceSlots.SingleAsync(x => x.OccurrenceId == occurrence.Id)).StartUtc);
            Assert.Equal(occurrence.StartUtc, (await db.EventSessions.SingleAsync(x => x.OccurrenceId == occurrence.Id)).StartUtc);
        }
    }

    [Fact]
    public async Task OmittedDetails_PreservePresetBehavior_ExplicitEmptySlotsSuppressPresets()
    {
        await using var db = Database(); var handler = Handler(db);
        Assert.True((await handler.Handle(Command(null), default)).IsSuccess);
        Assert.NotEmpty(await db.EventServiceSlots.ToListAsync());
        var previousCount = await db.EventServiceSlots.CountAsync();
        Assert.True((await handler.Handle(Command(new([], [], [])) with { IdempotencyKey = "empty-slots" }, default)).IsSuccess);
        Assert.Equal(previousCount, await db.EventServiceSlots.CountAsync());
    }
}
