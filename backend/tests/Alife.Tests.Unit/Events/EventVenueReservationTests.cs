using System.Text.Json;
using Alife.Api.Controllers;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using NSubstitute;

namespace Alife.Tests.Unit.Events;

public sealed class EventVenueReservationTests
{
    private static readonly DateTime StartUtc = new(2026, 9, 1, 10, 0, 0, DateTimeKind.Utc);

    [Fact]
    public async Task Workspace_RequiresAcceptedResourceCoordinatorOrEventManager()
    {
        await using var db = CreateDb();
        var seeded = Seed(db);
        var coordinator = Guid.NewGuid(); var invited = Guid.NewGuid(); var outsider = Guid.NewGuid();
        db.Members.AddRange(Member(coordinator, "Coordinator"), Member(invited, "Invited"), Member(outsider, "Outsider"));
        db.EventRoleAssignments.AddRange(
            Role(seeded.Event.Id, coordinator, seeded.Owner, EventRoleAssignmentStatus.Accepted),
            Role(seeded.Event.Id, invited, seeded.Owner, EventRoleAssignmentStatus.Invited));
        await db.SaveChangesAsync();
        var service = new EventVenueService(db, Authorization(seeded.Owner));

        Assert.True((await service.GetWorkspaceAsync(seeded.Event.Id, seeded.Owner, default)).IsSuccess);
        var coordinatorWorkspace = await service.GetWorkspaceAsync(seeded.Event.Id, coordinator, default);
        Assert.True(coordinatorWorkspace.IsSuccess);
        Assert.Equal(AppResultStatus.Forbidden, (await service.GetWorkspaceAsync(seeded.Event.Id, invited, default)).Status);
        Assert.Equal(AppResultStatus.Forbidden, (await service.GetWorkspaceAsync(seeded.Event.Id, outsider, default)).Status);
        var request = new ReserveEventVenueRequest(seeded.Venue.Id, seeded.Occurrence.Id, StartUtc, StartUtc.AddHours(1), 10);
        Assert.Equal(AppResultStatus.Forbidden, (await service.ReserveAsync(seeded.Event.Id, outsider, request,
            Assert.Single(coordinatorWorkspace.Value!.Venues).ETag, "outsider", default)).Status);
        Assert.True((await service.ReserveAsync(seeded.Event.Id, coordinator, request,
            Assert.Single(coordinatorWorkspace.Value.Venues).ETag, "coordinator", default)).IsSuccess);
    }

    [Fact]
    public async Task Reserve_RejectsOverlap_AllowsTouchingBoundary_AndIsIdempotent()
    {
        await using var db = CreateDb();
        var seeded = Seed(db);
        await db.SaveChangesAsync();
        var service = new EventVenueService(db, Authorization(seeded.Owner));
        var initial = await service.GetWorkspaceAsync(seeded.Event.Id, seeded.Owner, default);
        var eTag = Assert.Single(initial.Value!.Venues).ETag;
        var firstRequest = new ReserveEventVenueRequest(seeded.Venue.Id, seeded.Occurrence.Id, StartUtc, StartUtc.AddHours(1), 18);

        var first = await service.ReserveAsync(seeded.Event.Id, seeded.Owner, firstRequest, eTag, "reserve-1", default);
        Assert.True(first.IsSuccess, first.Message);
        Assert.True(first.Value!.Readiness.CapacitySufficient);
        Assert.True(first.Value.Readiness.BookingsConfirmed);
        Assert.True(first.Value.Readiness.ConflictsResolved);
        var retry = await service.ReserveAsync(seeded.Event.Id, seeded.Owner, firstRequest, eTag, "reserve-1", default);
        Assert.True(retry.IsSuccess, retry.Message);
        Assert.Single(await db.EventVenueReservations.ToListAsync());

        var currentVenueETag = Assert.Single(retry.Value!.Venues).ETag;
        var overlap = await service.ReserveAsync(seeded.Event.Id, seeded.Owner,
            new(seeded.Venue.Id, null, StartUtc.AddMinutes(30), StartUtc.AddMinutes(90), 10), currentVenueETag, "reserve-overlap", default);
        Assert.Equal(AppResultStatus.Conflict, overlap.Status);
        Assert.Contains("Hall", overlap.Message!, StringComparison.Ordinal);
        Assert.Contains("2026-09-01 10:00Z", overlap.Message!, StringComparison.Ordinal);

        var boundary = await service.ReserveAsync(seeded.Event.Id, seeded.Owner,
            new(seeded.Venue.Id, null, StartUtc.AddHours(1), StartUtc.AddHours(2), 10), currentVenueETag, "reserve-boundary", default);
        Assert.True(boundary.IsSuccess, boundary.Message);
        Assert.Equal(2, await db.EventVenueReservations.CountAsync());
    }

    [Fact]
    public async Task Capacity_IsValidatedForReservationAndCatalogueChanges()
    {
        await using var db = CreateDb();
        var seeded = Seed(db);
        await db.SaveChangesAsync();
        var service = new EventVenueService(db, Authorization(seeded.Owner));
        var initial = await service.GetWorkspaceAsync(seeded.Event.Id, seeded.Owner, default);
        var venue = Assert.Single(initial.Value!.Venues);

        var oversized = await service.ReserveAsync(seeded.Event.Id, seeded.Owner,
            new(seeded.Venue.Id, seeded.Occurrence.Id, StartUtc, StartUtc.AddHours(1), 21), venue.ETag, "oversized", default);
        Assert.Equal(AppResultStatus.ValidationError, oversized.Status);
        Assert.Contains("capacity is 20", oversized.Message!, StringComparison.Ordinal);

        var reserved = await service.ReserveAsync(seeded.Event.Id, seeded.Owner,
            new(seeded.Venue.Id, seeded.Occurrence.Id, StartUtc, StartUtc.AddHours(1), 18), venue.ETag, "fits", default);
        var updatedVenue = Assert.Single(reserved.Value!.Venues);
        var reduced = await service.UpdateVenueAsync(seeded.Group.Id, seeded.Venue.Id, seeded.Owner,
            new(new("Hall", "禮堂"), new("1 Main Road", "主路 1 號"), 17), updatedVenue.ETag, default);
        Assert.Equal(AppResultStatus.Conflict, reduced.Status);
    }

    [Fact]
    public async Task VenueToken_PreventsStaleBoundaryBookingFromOverwritingAnotherReservation()
    {
        var databaseName = Guid.NewGuid().ToString("N");
        var root = new InMemoryDatabaseRoot();
        var options = new DbContextOptionsBuilder<AlifeDbContext>().UseInMemoryDatabase(databaseName, root).Options;
        Seeded seeded;
        await using (var seedDb = new AlifeDbContext(options)) { seeded = Seed(seedDb); await seedDb.SaveChangesAsync(); }
        await using var firstDb = new AlifeDbContext(options);
        await using var staleDb = new AlifeDbContext(options);
        var firstVenue = await firstDb.EventVenues.SingleAsync();
        var staleVenue = await staleDb.EventVenues.SingleAsync();
        var firstService = new EventVenueService(firstDb, Authorization());
        var staleService = new EventVenueService(staleDb, Authorization());
        var eTag = $"\"venue-{firstVenue.ConcurrencyToken:N}\"";
        Assert.Equal(firstVenue.ConcurrencyToken, staleVenue.ConcurrencyToken);

        var first = await firstService.ReserveAsync(seeded.Event.Id, seeded.Owner,
            new(seeded.Venue.Id, seeded.Occurrence.Id, StartUtc, StartUtc.AddHours(1), 10), eTag, "concurrent-1", default);
        var stale = await staleService.ReserveAsync(seeded.Event.Id, seeded.Owner,
            new(seeded.Venue.Id, null, StartUtc.AddHours(1), StartUtc.AddHours(2), 10), eTag, "concurrent-2", default);

        Assert.True(first.IsSuccess, first.Message);
        Assert.Equal(AppResultStatus.PreconditionFailed, stale.Status);
        Assert.Contains("venue changed while reserving", stale.Message!, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Release_IsAuditedAndUpdatesBookingsReadinessWithoutDeletingHistory()
    {
        await using var db = CreateDb();
        var seeded = Seed(db); await db.SaveChangesAsync();
        var service = new EventVenueService(db, Authorization());
        var workspace = await service.GetWorkspaceAsync(seeded.Event.Id, seeded.Owner, default);
        var reserved = await service.ReserveAsync(seeded.Event.Id, seeded.Owner,
            new(seeded.Venue.Id, seeded.Occurrence.Id, StartUtc, StartUtc.AddHours(1), 10),
            Assert.Single(workspace.Value!.Venues).ETag, "release-seed", default);
        var reservation = Assert.Single(reserved.Value!.Reservations);

        var released = await service.ReleaseAsync(seeded.Event.Id, reservation.Id, seeded.Owner, reservation.ETag, "release-1", default);
        Assert.True(released.IsSuccess, released.Message);
        Assert.False(released.Value!.Readiness.BookingsConfirmed);
        var history = Assert.Single(released.Value.Reservations);
        Assert.Equal(EventVenueReservationStatus.Released, history.Status);
        Assert.Equal(seeded.Owner, history.ReleasedByMemberId);
        Assert.NotNull(history.ReleasedUtc);
        var retry = await service.ReleaseAsync(seeded.Event.Id, reservation.Id, seeded.Owner, reservation.ETag, "release-1", default);
        Assert.True(retry.IsSuccess, retry.Message);
        Assert.Single(await db.EventVenueReservations.ToListAsync());
    }

    [Fact]
    public async Task LegacySessionPlace_RemainsReadableAndUnchanged()
    {
        await using var db = CreateDb();
        var seeded = Seed(db);
        const string legacyPlace = "{\"en\":\"Old hall note\",\"zh\":\"舊場地備註\"}";
        db.EventSessions.Add(new EventSession { Id = Guid.NewGuid(), OccurrenceId = seeded.Occurrence.Id,
            TitleEn = "Session", TitleZh = "環節", StartUtc = StartUtc, EndUtc = StartUtc.AddMinutes(30),
            PlaceJson = legacyPlace, CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow });
        await db.SaveChangesAsync();

        var workspace = await new EventVenueService(db, Authorization()).GetWorkspaceAsync(seeded.Event.Id, seeded.Owner, default);

        Assert.True(workspace.IsSuccess);
        Assert.True(workspace.Value!.LegacySessionPlacePreserved);
        Assert.Equal(legacyPlace, (await db.EventSessions.SingleAsync()).PlaceJson);
    }

    [Fact]
    public async Task VenueEvidence_FlowsThroughSharedReadinessAndProtectsModuleRetirement()
    {
        await using var db = CreateDb();
        var seeded = Seed(db);
        db.EventRoleAssignments.Add(Role(seeded.Event.Id, seeded.Owner, seeded.Owner, EventRoleAssignmentStatus.Accepted));
        await db.SaveChangesAsync();
        var service = new EventVenueService(db, Authorization());
        var initial = await service.GetWorkspaceAsync(seeded.Event.Id, seeded.Owner, default);
        var reserved = await service.ReserveAsync(seeded.Event.Id, seeded.Owner,
            new(seeded.Venue.Id, seeded.Occurrence.Id, StartUtc, StartUtc.AddHours(1), 20),
            Assert.Single(initial.Value!.Venues).ETag, "readiness-reserve", default);
        Assert.True(reserved.IsSuccess, reserved.Message);
        var stored = await db.EventPlanSnapshots.AsNoTracking().SingleAsync();
        var plan = EventCompositionPersistence.RefreshReadiness(
            EventCompositionPersistence.ToSnapshotDto(stored).Plan, seeded.Event, DateTime.UtcNow);

        var operational = await EventCompositionPersistence.ApplyOperationalReadinessAsync(
            db, plan, seeded.Event, DateTime.UtcNow, default);

        var place = Assert.Single(operational.Navigation, x => x.ModuleCode == "PLACE.RESOURCE");
        Assert.Empty(place.Blockers);
        Assert.Equal(EventReadinessStatus.Ready, place.Readiness);
        Assert.Contains("PLACE.RESOURCE", await EventCompositionPersistence.GetProtectedModuleCodesAsync(db, seeded.Event, default));
    }

    [Fact]
    public async Task ManagementEndpoint_IsPrivateNoStore()
    {
        var eventId = Guid.NewGuid(); var memberId = Guid.NewGuid(); var groupId = Guid.NewGuid();
        var service = Substitute.For<IEventVenueService>();
        service.GetWorkspaceAsync(eventId, memberId, Arg.Any<CancellationToken>()).Returns(
            AppResult<EventVenueWorkspaceDto>.Success(new(eventId, groupId, [], [], [], new(true, true, true, []), true, true, true)));
        var accessor = Substitute.For<ICurrentMemberAccessor>(); accessor.GetCurrentMemberId().Returns(memberId);
        var controller = new EventVenuesController(service, accessor)
        { ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() } };

        var response = await controller.GetWorkspace(eventId, default);

        Assert.IsType<OkObjectResult>(response);
        Assert.Equal("no-store", controller.Response.Headers.CacheControl.ToString());
        Assert.Equal("no-cache", controller.Response.Headers.Pragma.ToString());
    }

    private static AlifeDbContext CreateDb() => new(new DbContextOptionsBuilder<AlifeDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString("N")).Options);
    private static Seeded Seed(AlifeDbContext db)
    {
        var owner = Guid.NewGuid(); var group = new Group { Id = Guid.NewGuid(), NameJson = "{}", CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow };
        var groupEvent = new GroupEvent { Id = Guid.NewGuid(), GroupId = group.Id, CreatedByMemberId = owner, AccountableOwnerMemberId = owner,
            TitleEn = "Venue event", TitleZh = "場地活動", StartDate = StartUtc, EndDate = StartUtc.AddHours(3),
            CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow };
        var occurrence = new EventOccurrence { Id = Guid.NewGuid(), EventId = groupEvent.Id, StartUtc = StartUtc,
            EndUtc = StartUtc.AddHours(1), LocalDate = DateOnly.FromDateTime(StartUtc), CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow };
        var venue = new EventVenue { Id = Guid.NewGuid(), ManagingGroupId = group.Id, NameEn = "Hall", NameZh = "禮堂",
            AddressEn = "1 Main Road", AddressZh = "主路 1 號", Capacity = 20, CreatedByMemberId = owner,
            CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow };
        db.Groups.Add(group); db.Members.Add(Member(owner, "Owner")); db.GroupEvents.Add(groupEvent); db.EventOccurrences.Add(occurrence); db.EventVenues.Add(venue);
        SeedPlacePlan(db, groupEvent);
        return new(group, groupEvent, occurrence, venue, owner);
    }
    private static void SeedPlacePlan(AlifeDbContext db, GroupEvent groupEvent)
    {
        var facts = new[] { Fact("place.resourcesRequired", true) };
        var plan = new EventCompositionEngine().Compose(new(EventCompositionDefinitions.LegacySchemaVersion, null,
            new(facts), []), new EventCompositionContext("\"baseline\"", HasAccountableOwner: true)).Value!;
        groupEvent.ActivePlanVersion = 1;
        db.EventPlanSnapshots.Add(new EventPlanSnapshot { Id = Guid.NewGuid(), EventId = groupEvent.Id, Version = 1,
            SourceFactSetId = Guid.NewGuid(), SchemaVersion = plan.SchemaVersion, ProposalHash = plan.ProposalHash,
            ETag = EventCompositionPersistence.CreatePlanETag(1, plan.ProposalHash), SnapshotJson = EventCompositionPersistence.SerializePlan(plan, []),
            IsActive = true, AcceptedByMemberId = groupEvent.AccountableOwnerMemberId, AcceptedUtc = DateTime.UtcNow, CreatedUtc = DateTime.UtcNow });
    }
    private static EventRoleAssignment Role(Guid eventId, Guid memberId, Guid assignedBy, EventRoleAssignmentStatus status)
        => new() { Id = Guid.NewGuid(), EventId = eventId, RoleRequirementKey = "PLACE.RESOURCE:resource.coordinator",
            MemberId = memberId, AssignedByMemberId = assignedBy, Status = status,
            AcceptedUtc = status == EventRoleAssignmentStatus.Accepted ? DateTime.UtcNow : null,
            CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow };
    private static Member Member(Guid id, string name) => new() { Id = id, DisplayName = name, IsRegistered = true,
        CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow };
    private static IGroupAuthorizationService Authorization(Guid? leader = null)
    {
        var result = Substitute.For<IGroupAuthorizationService>();
        result.IsApprovedMemberAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(true);
        result.IsLeaderOrCoLeaderAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(call => leader.HasValue && call.ArgAt<Guid>(1) == leader.Value);
        return result;
    }
    private static EventFactInputDto Fact(string code, object value) => new(code, JsonSerializer.SerializeToElement(value),
        EventFactCertainty.Confirmed, EventFactSource.Human);
    private sealed record Seeded(Group Group, GroupEvent Event, EventOccurrence Occurrence, EventVenue Venue, Guid Owner);
}
