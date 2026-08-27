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

public sealed class EventTravelManifestTests
{
    private static readonly DateTime OccurrenceStart = new(2026, 10, 10, 9, 0, 0, DateTimeKind.Utc);

    [Fact]
    public async Task Workspace_RequiresAcceptedTravelCoordinator_NotOrdinaryEventTeam()
    {
        await using var db = CreateDb();
        var seeded = Seed(db);
        var coordinator = AddMember(db, "Travel coordinator");
        var ordinaryTeam = AddMember(db, "Ordinary team");
        db.EventRoleAssignments.Add(Role(seeded.Event.Id, coordinator.Id, seeded.Owner));
        db.EventTeamMembers.Add(new EventTeamMember { Id = Guid.NewGuid(), EventId = seeded.Event.Id, MemberId = ordinaryTeam.Id,
            InvitedByMemberId = seeded.Owner, Status = EventTeamMemberStatus.Accepted, JoinedUtc = DateTime.UtcNow,
            CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow });
        await db.SaveChangesAsync();
        var service = new EventTravelService(db, Authorization(seeded.Owner));

        Assert.True((await service.GetWorkspaceAsync(seeded.Event.Id, seeded.Owner, default)).IsSuccess);
        Assert.True((await service.GetWorkspaceAsync(seeded.Event.Id, coordinator.Id, default)).IsSuccess);
        Assert.Equal(AppResultStatus.Forbidden, (await service.GetWorkspaceAsync(seeded.Event.Id, ordinaryTeam.Id, default)).Status);
        var request = new SaveEventTravelDriverRequest(coordinator.Id, "Class 1", new DateOnly(2027, 1, 1), true, true, "Checked for this event");
        Assert.True((await service.CreateDriverAsync(seeded.Event.Id, coordinator.Id, request, "driver-create", default)).IsSuccess);
        Assert.True((await service.CreateDriverAsync(seeded.Event.Id, coordinator.Id, request, "driver-create", default)).IsSuccess);
        Assert.Single(await db.EventTravelDrivers.ToListAsync());
        Assert.Equal(AppResultStatus.Forbidden,
            (await service.CreateDriverAsync(seeded.Event.Id, ordinaryTeam.Id, request, "ordinary-team", default)).Status);
    }

    [Fact]
    public async Task MyJourneyProjection_ContainsOnlyCurrentParticipantsOwnJourney()
    {
        await using var db = CreateDb();
        var seeded = Seed(db);
        var first = AddApprovedMember(db, seeded.Group.Id, "First passenger");
        var second = AddApprovedMember(db, seeded.Group.Id, "Other passenger");
        var travel = AddCompleteJourney(db, seeded, first.Id, second.Id);
        await db.SaveChangesAsync();

        var result = await new EventTravelService(db, Authorization()).GetMyJourneysAsync(seeded.Event.Id, first.Id, default);

        Assert.True(result.IsSuccess, result.Message);
        var own = Assert.Single(result.Value!.Journeys);
        Assert.Equal(travel.Stop.Id, travel.FirstAssignment.PickupStopId);
        Assert.Equal("Church car", own.VehicleName!.En);
        var json = JsonSerializer.Serialize(result.Value);
        Assert.DoesNotContain("Other passenger", json, StringComparison.Ordinal);
        Assert.Equal("userSpecific", result.Value.DataClassification);
    }

    [Fact]
    public async Task Readiness_ExplainsJourneyDriverVehicleManifestAndRamBlockers()
    {
        await using var db = CreateDb();
        var seeded = Seed(db, ramJson: "{\"outingSafety\":{\"transportRequired\":true,\"licensedDriverConfirmed\":false}}");
        var journey = new EventTravelJourney { Id = Guid.NewGuid(), EventId = seeded.Event.Id, EventOccurrenceId = seeded.Occurrence.Id,
            NameEn = "Morning pickup", NameZh = "早晨接送", StartUtc = OccurrenceStart.AddHours(-1), EndUtc = OccurrenceStart,
            CreatedByMemberId = seeded.Owner, CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow };
        db.EventTravelJourneys.Add(journey);
        await db.SaveChangesAsync();

        var result = await new EventTravelService(db, Authorization(seeded.Owner)).GetWorkspaceAsync(seeded.Event.Id, seeded.Owner, default);

        Assert.True(result.IsSuccess, result.Message);
        var blockers = result.Value!.Readiness.Blockers.Select(x => x.En).ToArray();
        Assert.Contains(blockers, x => x.Contains("no eligible driver", StringComparison.Ordinal));
        Assert.Contains(blockers, x => x.Contains("vehicle evidence is incomplete", StringComparison.Ordinal));
        Assert.Contains(blockers, x => x.Contains("passenger manifest is incomplete", StringComparison.Ordinal));
        Assert.Contains(blockers, x => x.Contains("RAM transport checks are incomplete", StringComparison.Ordinal));
    }

    [Fact]
    public async Task CompleteTransportEvidence_SatisfiesMoveReadinessWithoutChangingRamApproval()
    {
        await using var db = CreateDb();
        var ramJson = CompleteRamJson();
        var seeded = Seed(db, ramJson, EventRamStatus.Approved);
        var passenger = AddApprovedMember(db, seeded.Group.Id, "Passenger");
        AddCompleteJourney(db, seeded, passenger.Id);
        db.EventRoleAssignments.Add(Role(seeded.Event.Id, seeded.Owner, seeded.Owner));
        await db.SaveChangesAsync();
        var service = new EventTravelService(db, Authorization(seeded.Owner));

        var workspace = await service.GetWorkspaceAsync(seeded.Event.Id, seeded.Owner, default);
        var snapshot = await db.EventPlanSnapshots.AsNoTracking().SingleAsync();
        var basePlan = EventCompositionPersistence.RefreshReadiness(EventCompositionPersistence.ToSnapshotDto(snapshot).Plan, seeded.Event, DateTime.UtcNow);
        var operational = await EventCompositionPersistence.ApplyOperationalReadinessAsync(db, basePlan, seeded.Event, DateTime.UtcNow, default);

        Assert.True(workspace.IsSuccess, workspace.Message);
        Assert.True(workspace.Value!.Readiness.DriversAndVehiclesQualified);
        Assert.True(workspace.Value.Readiness.PassengerManifestsComplete);
        Assert.True(workspace.Value.Readiness.RamTransportChecksComplete);
        Assert.Empty(Assert.Single(operational.Navigation, x => x.ModuleCode == "MOVE.STAY").Blockers);
        var ram = await db.EventRamAssessments.SingleAsync();
        Assert.Equal(ramJson, ram.RamDataJson);
        Assert.Equal(EventRamStatus.Approved, ram.Status);
        Assert.Contains("MOVE.STAY", await EventCompositionPersistence.GetProtectedModuleCodesAsync(db, seeded.Event, default));
    }

    [Fact]
    public async Task PassengerAssignment_EnforcesCapacity()
    {
        await using var db = CreateDb();
        var seeded = Seed(db);
        var first = AddApprovedMember(db, seeded.Group.Id, "First");
        var second = AddApprovedMember(db, seeded.Group.Id, "Second");
        var travel = AddCompleteJourney(db, seeded, first.Id);
        travel.Vehicle.SeatCapacity = 1;
        await db.SaveChangesAsync();
        var service = new EventTravelService(db, Authorization(seeded.Owner));
        var workspace = await service.GetWorkspaceAsync(seeded.Event.Id, seeded.Owner, default);
        var journey = Assert.Single(workspace.Value!.Journeys);

        var result = await service.AssignPassengerAsync(seeded.Event.Id, journey.Id, seeded.Owner,
            new(second.Id, travel.Stop.Id), journey.ETag, "capacity-assignment", default);

        Assert.Equal(AppResultStatus.Conflict, result.Status);
        Assert.Contains("capacity 1", result.Message!, StringComparison.Ordinal);
    }

    [Fact]
    public async Task StaleJourneyToken_PreventsConcurrentPassengerAssignment()
    {
        var root = new InMemoryDatabaseRoot();
        var options = new DbContextOptionsBuilder<AlifeDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString("N"), root).Options;
        Seeded seeded;
        Guid firstPassenger;
        Guid secondPassenger;
        Guid stopId;
        await using (var seedDb = new AlifeDbContext(options))
        {
            seeded = Seed(seedDb);
            firstPassenger = AddApprovedMember(seedDb, seeded.Group.Id, "First").Id;
            secondPassenger = AddApprovedMember(seedDb, seeded.Group.Id, "Second").Id;
            var travel = AddCompleteJourney(seedDb, seeded);
            stopId = travel.Stop.Id;
            await seedDb.SaveChangesAsync();
        }
        await using var firstDb = new AlifeDbContext(options);
        await using var staleDb = new AlifeDbContext(options);
        var firstService = new EventTravelService(firstDb, Authorization(seeded.Owner));
        var staleService = new EventTravelService(staleDb, Authorization(seeded.Owner));
        var firstView = await firstService.GetWorkspaceAsync(seeded.Event.Id, seeded.Owner, default);
        var staleView = await staleService.GetWorkspaceAsync(seeded.Event.Id, seeded.Owner, default);
        var firstJourney = Assert.Single(firstView.Value!.Journeys);
        var staleJourney = Assert.Single(staleView.Value!.Journeys);

        var winner = await firstService.AssignPassengerAsync(seeded.Event.Id, firstJourney.Id, seeded.Owner,
            new(firstPassenger, stopId), firstJourney.ETag, "winner", default);
        var loser = await staleService.AssignPassengerAsync(seeded.Event.Id, staleJourney.Id, seeded.Owner,
            new(secondPassenger, stopId), staleJourney.ETag, "loser", default);

        Assert.True(winner.IsSuccess, winner.Message);
        Assert.Equal(AppResultStatus.PreconditionFailed, loser.Status);
    }

    [Fact]
    public async Task ManagementAndSelfEndpoints_ArePrivateNoStore()
    {
        var eventId = Guid.NewGuid(); var memberId = Guid.NewGuid();
        var service = Substitute.For<IEventTravelService>();
        service.GetMyJourneysAsync(eventId, memberId, Arg.Any<CancellationToken>()).Returns(
            AppResult<EventTravelMyJourneysDto>.Success(new(eventId, [], "userSpecific")));
        var accessor = Substitute.For<ICurrentMemberAccessor>(); accessor.GetCurrentMemberId().Returns(memberId);
        var controller = new EventTravelController(service, accessor)
        { ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() } };

        var response = await controller.GetMyJourneys(eventId, default);

        Assert.IsType<OkObjectResult>(response);
        Assert.Equal("private, no-store", controller.Response.Headers.CacheControl.ToString());
        Assert.Equal("no-cache", controller.Response.Headers.Pragma.ToString());
    }

    private static AlifeDbContext CreateDb() => new(new DbContextOptionsBuilder<AlifeDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString("N")).Options);

    private static Seeded Seed(AlifeDbContext db, string? ramJson = null, EventRamStatus ramStatus = EventRamStatus.Draft)
    {
        var owner = Guid.NewGuid();
        var group = new Group { Id = Guid.NewGuid(), NameJson = "{}", CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow };
        var ownerMember = Member(owner, "Owner");
        var groupEvent = new GroupEvent { Id = Guid.NewGuid(), GroupId = group.Id, CreatedByMemberId = owner,
            AccountableOwnerMemberId = owner, TitleEn = "Travel event", TitleZh = "交通活動", StartDate = OccurrenceStart,
            EndDate = OccurrenceStart.AddHours(4), CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow,
            RamAssessment = new EventRamAssessment { RamDataJson = ramJson ?? CompleteRamJson(), Status = ramStatus,
                CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow } };
        var occurrence = new EventOccurrence { Id = Guid.NewGuid(), EventId = groupEvent.Id, StartUtc = OccurrenceStart,
            EndUtc = OccurrenceStart.AddHours(3), LocalDate = DateOnly.FromDateTime(OccurrenceStart),
            CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow };
        db.Groups.Add(group); db.Members.Add(ownerMember); db.GroupEvents.Add(groupEvent); db.EventOccurrences.Add(occurrence);
        SeedMovePlan(db, groupEvent);
        return new(group, groupEvent, occurrence, owner);
    }

    private static TravelSeed AddCompleteJourney(AlifeDbContext db, Seeded seeded, params Guid[] passengers)
    {
        var driverMember = AddApprovedMember(db, seeded.Group.Id, "Driver");
        var driver = new EventTravelDriver { Id = Guid.NewGuid(), EventId = seeded.Event.Id, MemberId = driverMember.Id,
            LicenceClass = "Class 1", LicenceExpiresOn = new DateOnly(2027, 1, 1), LicenceConfirmed = true,
            FitToDriveConfirmed = true, IsActive = true, VerifiedByMemberId = seeded.Owner, VerifiedUtc = DateTime.UtcNow,
            CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow };
        var vehicle = new EventTravelVehicle { Id = Guid.NewGuid(), EventId = seeded.Event.Id, NameEn = "Church car", NameZh = "教會車",
            RegistrationReference = Guid.NewGuid().ToString("N")[..8], SeatCapacity = 8, RegistrationConfirmed = true,
            RegistrationExpiresOn = new DateOnly(2027, 1, 1), WofConfirmed = true, WofExpiresOn = new DateOnly(2027, 1, 1),
            IsActive = true, VerifiedByMemberId = seeded.Owner, VerifiedUtc = DateTime.UtcNow,
            CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow };
        var journey = new EventTravelJourney { Id = Guid.NewGuid(), EventId = seeded.Event.Id, EventOccurrenceId = seeded.Occurrence.Id,
            NameEn = "Morning pickup", NameZh = "早晨接送", StartUtc = OccurrenceStart.AddHours(-1), EndUtc = OccurrenceStart,
            DriverId = driver.Id, VehicleId = vehicle.Id, Driver = driver, Vehicle = vehicle, EventOccurrence = seeded.Occurrence,
            ManifestConfirmed = passengers.Length > 0, CreatedByMemberId = seeded.Owner, CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow };
        var stop = new EventTravelPickupStop { Id = Guid.NewGuid(), JourneyId = journey.Id, SortOrder = 0,
            NameEn = "Central pickup", NameZh = "市中心接送點", PickupUtc = OccurrenceStart.AddMinutes(-45),
            CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow };
        journey.PickupStops.Add(stop);
        EventTravelPassengerAssignment? first = null;
        foreach (var passenger in passengers)
        {
            var assignment = new EventTravelPassengerAssignment { Id = Guid.NewGuid(), JourneyId = journey.Id, MemberId = passenger,
                PickupStopId = stop.Id, PickupStop = stop, AssignedByMemberId = seeded.Owner, AssignedUtc = DateTime.UtcNow };
            journey.PassengerAssignments.Add(assignment); first ??= assignment;
        }
        db.EventTravelDrivers.Add(driver); db.EventTravelVehicles.Add(vehicle); db.EventTravelJourneys.Add(journey);
        return new(driver, vehicle, journey, stop, first ?? new EventTravelPassengerAssignment());
    }

    private static void SeedMovePlan(AlifeDbContext db, GroupEvent groupEvent)
    {
        var facts = new[] { Fact("move.transportRequired", true), Fact("move.accommodationRequired", false) };
        var plan = new EventCompositionEngine().Compose(new(EventCompositionDefinitions.LegacySchemaVersion, null,
            new(facts), []), new EventCompositionContext("\"baseline\"", HasAccountableOwner: true)).Value!;
        groupEvent.ActivePlanVersion = 1;
        db.EventPlanSnapshots.Add(new EventPlanSnapshot { Id = Guid.NewGuid(), EventId = groupEvent.Id, Version = 1,
            SourceFactSetId = Guid.NewGuid(), SchemaVersion = plan.SchemaVersion, ProposalHash = plan.ProposalHash,
            ETag = EventCompositionPersistence.CreatePlanETag(1, plan.ProposalHash), SnapshotJson = EventCompositionPersistence.SerializePlan(plan, []),
            IsActive = true, AcceptedByMemberId = groupEvent.AccountableOwnerMemberId, AcceptedUtc = DateTime.UtcNow, CreatedUtc = DateTime.UtcNow });
    }

    private static EventFactInputDto Fact(string code, object value) => new(code, JsonSerializer.SerializeToElement(value), EventFactCertainty.Confirmed, EventFactSource.Human);
    private static EventRoleAssignment Role(Guid eventId, Guid memberId, Guid assignedBy) => new() { Id = Guid.NewGuid(), EventId = eventId,
        RoleRequirementKey = "MOVE.STAY:travel.coordinator", MemberId = memberId, AssignedByMemberId = assignedBy,
        Status = EventRoleAssignmentStatus.Accepted, AcceptedUtc = DateTime.UtcNow, CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow };
    private static Member AddMember(AlifeDbContext db, string name) { var member = Member(Guid.NewGuid(), name); db.Members.Add(member); return member; }
    private static Member AddApprovedMember(AlifeDbContext db, Guid groupId, string name) { var member = AddMember(db, name); db.GroupMemberships.Add(new GroupMembership { Id = Guid.NewGuid(), GroupId = groupId, MemberId = member.Id, Status = MembershipStatus.Approved, Role = MembershipRole.Member, CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow }); return member; }
    private static Member Member(Guid id, string name) => new() { Id = id, DisplayName = name, IsRegistered = true, CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow };
    private static IGroupAuthorizationService Authorization(Guid? leader = null)
    {
        var result = Substitute.For<IGroupAuthorizationService>();
        result.IsApprovedMemberAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(true);
        result.IsLeaderOrCoLeaderAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(call => leader.HasValue && call.ArgAt<Guid>(1) == leader.Value);
        return result;
    }
    private static string CompleteRamJson() => "{\"outingSafety\":{\"transportRequired\":true,\"licensedDriverConfirmed\":true,\"vehicleRegistrationConfirmed\":true,\"vehicleWofConfirmed\":true}}";
    private sealed record Seeded(Group Group, GroupEvent Event, EventOccurrence Occurrence, Guid Owner);
    private sealed record TravelSeed(EventTravelDriver Driver, EventTravelVehicle Vehicle, EventTravelJourney Journey, EventTravelPickupStop Stop, EventTravelPassengerAssignment FirstAssignment);
}
