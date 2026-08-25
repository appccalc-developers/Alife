using Alife.Application.Admin;
using Alife.Application.Groups.Services;
using Alife.Application.Venues.Commands.ReviewVenueBooking;
using Alife.Application.Venues.Commands.SaveEventVenueBooking;
using Alife.Application.Venues.Commands.SaveVenue;
using Alife.Application.Venues.Commands.SubmitVenueBooking;
using Alife.Application.Venues.Queries.GetEventVenueWorkspace;
using Alife.Application.Venues.Queries.ListManagedVenues;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.Venues;

public sealed class VenueWorkflowTests
{
    [Fact]
    public async Task Catalog_starts_empty_and_only_catalog_permission_can_add_real_venues()
    {
        await using var db = CreateDbContext();
        var church = NewChurch();
        var manager = NewMember();
        var ordinaryMember = NewMember();
        AddPermission(db, manager, AdminPermissionCatalog.ManageVenueCatalog, roleId: 501);
        db.AddRange(church, ordinaryMember);
        await db.SaveChangesAsync();

        var listHandler = new ListManagedVenuesQueryHandler(db);
        var empty = await listHandler.Handle(new ListManagedVenuesQuery(church.Id, manager.Id), CancellationToken.None);
        Assert.True(empty.IsSuccess);
        Assert.Empty(empty.Value!);

        var command = ValidVenueCommand(church.Id, ordinaryMember.Id);
        var forbidden = await new SaveVenueCommandHandler(db).Handle(command, CancellationToken.None);
        Assert.Equal(Alife.Application.Common.Models.AppResultStatus.Forbidden, forbidden.Status);

        var created = await new SaveVenueCommandHandler(db).Handle(command with { CurrentMemberId = manager.Id }, CancellationToken.None);
        Assert.True(created.IsSuccess);
        Assert.Equal("Main hall", created.Value!.Spaces.Single().Name["en"]);
        Assert.Single(await db.Venues.ToListAsync());
        Assert.Contains(await db.AuditLogs.ToListAsync(), x => x.Action == "venue.catalog.created" && x.EntityId == created.Value.Id);
    }

    [Fact]
    public async Task Event_workspace_reads_only_active_spaces_from_its_church_catalog()
    {
        await using var db = CreateDbContext();
        var church = NewChurch();
        var group = NewGroup(church.Id);
        var leader = NewMember();
        var groupEvent = NewEvent(group.Id, leader.Id);
        var venue = NewVenue(church.Id, leader.Id, true);
        venue.Spaces.Add(NewSpace(venue.Id, "Open room", true));
        venue.Spaces.Add(NewSpace(venue.Id, "Closed room", false));
        var inactiveVenue = NewVenue(church.Id, leader.Id, false);
        inactiveVenue.Spaces.Add(NewSpace(inactiveVenue.Id, "Hidden room", true));
        db.AddRange(church, group, leader, groupEvent, venue, inactiveVenue);
        await db.SaveChangesAsync();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(group.Id, leader.Id, Arg.Any<CancellationToken>()).Returns(true);

        var result = await new GetEventVenueWorkspaceQueryHandler(db, authorization)
            .Handle(new GetEventVenueWorkspaceQuery(groupEvent.Id, leader.Id), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var visibleVenue = Assert.Single(result.Value!.Venues);
        Assert.Equal("Open room", Assert.Single(visibleVenue.Spaces).Name["en"]);
    }

    [Fact]
    public async Task Event_without_venue_module_cannot_open_or_create_a_request()
    {
        await using var db = CreateDbContext();
        var setup = await SeedEventAndVenueAsync(db);
        setup.Event.EventDataJson = "{\"visibility\":\"groupVisible\",\"enabledModules\":[]}";
        await db.SaveChangesAsync();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(setup.Group.Id, setup.Leader.Id, Arg.Any<CancellationToken>()).Returns(true);

        var workspace = await new GetEventVenueWorkspaceQueryHandler(db, authorization)
            .Handle(new GetEventVenueWorkspaceQuery(setup.Event.Id, setup.Leader.Id), CancellationToken.None);
        var save = await new SaveEventVenueBookingCommandHandler(db, authorization)
            .Handle(NewBookingCommand(setup, attendeeCount: 20), CancellationToken.None);

        Assert.Equal(Alife.Application.Common.Models.AppResultStatus.Conflict, workspace.Status);
        Assert.Equal(Alife.Application.Common.Models.AppResultStatus.Conflict, save.Status);
        Assert.Empty(await db.EventVenueBookings.ToListAsync());
    }

    [Fact]
    public async Task Booking_must_fit_capacity_and_is_human_submitted_before_review()
    {
        await using var db = CreateDbContext();
        var setup = await SeedEventAndVenueAsync(db);
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(setup.Group.Id, setup.Leader.Id, Arg.Any<CancellationToken>()).Returns(true);
        var save = new SaveEventVenueBookingCommandHandler(db, authorization);

        var tooLarge = await save.Handle(NewBookingCommand(setup, attendeeCount: 101), CancellationToken.None);
        Assert.Equal(Alife.Application.Common.Models.AppResultStatus.ValidationError, tooLarge.Status);

        var draft = await save.Handle(NewBookingCommand(setup, attendeeCount: 80), CancellationToken.None);
        Assert.True(draft.IsSuccess);
        Assert.Equal(VenueBookingStatus.Draft, draft.Value!.Status);

        var submitted = await new SubmitVenueBookingCommandHandler(db, authorization)
            .Handle(new SubmitVenueBookingCommand(setup.Event.Id, draft.Value.Id, setup.Leader.Id), CancellationToken.None);
        Assert.True(submitted.IsSuccess);
        Assert.Equal(VenueBookingStatus.Submitted, submitted.Value!.Status);
        Assert.Equal(setup.Leader.Id, submitted.Value.SubmittedByMemberId);
        Assert.Contains(await db.AuditLogs.ToListAsync(), x => x.Action == "venue.booking.submitted" && x.EntityId == draft.Value.Id);
    }

    [Fact]
    public async Task Reviewer_approval_reserves_space_and_records_the_human_decision()
    {
        await using var db = CreateDbContext();
        var setup = await SeedEventAndVenueAsync(db);
        var reviewer = NewMember();
        AddPermission(db, reviewer, AdminPermissionCatalog.ReviewVenueBookings, roleId: 503);
        var submitted = NewBooking(setup, VenueBookingStatus.Submitted, setup.Event.StartDate, setup.Event.EndDate);
        db.Add(submitted);
        await db.SaveChangesAsync();

        var result = await new ReviewVenueBookingCommandHandler(db).Handle(
            new ReviewVenueBookingCommand(submitted.Id, reviewer.Id, true, "Capacity and timing confirmed."),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(VenueBookingStatus.Approved, result.Value!.Status);
        Assert.Contains(await db.AuditLogs.ToListAsync(), x => x.Action == "venue.booking.approved" && x.EntityId == submitted.Id && x.ActorMemberId == reviewer.Id);
    }

    [Fact]
    public async Task Reviewer_cannot_approve_overlapping_booking_for_same_space()
    {
        await using var db = CreateDbContext();
        var setup = await SeedEventAndVenueAsync(db);
        var reviewer = NewMember();
        AddPermission(db, reviewer, AdminPermissionCatalog.ReviewVenueBookings, roleId: 502);
        var approved = NewBooking(setup, VenueBookingStatus.Approved, setup.Event.StartDate, setup.Event.EndDate);
        var submitted = NewBooking(setup, VenueBookingStatus.Submitted, setup.Event.StartDate.AddHours(1), setup.Event.EndDate.AddHours(1));
        db.AddRange(reviewer, approved, submitted);
        await db.SaveChangesAsync();

        var result = await new ReviewVenueBookingCommandHandler(db).Handle(
            new ReviewVenueBookingCommand(submitted.Id, reviewer.Id, true, string.Empty),
            CancellationToken.None);

        Assert.Equal(Alife.Application.Common.Models.AppResultStatus.Conflict, result.Status);
        Assert.Equal(VenueBookingStatus.Submitted, (await db.EventVenueBookings.FindAsync(submitted.Id))!.Status);
    }

    [Fact]
    public async Task Requester_cannot_review_their_own_venue_request_even_with_review_permission()
    {
        await using var db = CreateDbContext();
        var setup = await SeedEventAndVenueAsync(db);
        var role = new PlatformRole
        {
            Id = 504, Code = "venue_self_review_test", NameJson = "{}",
            PermissionsJson = AdminPermissionCatalog.WritePermissions([AdminPermissionCatalog.ReviewVenueBookings]), Level = 1
        };
        db.AddRange(role, new MemberPlatformRole
        {
            Id = Guid.NewGuid(), MemberId = setup.Leader.Id, RoleId = role.Id, AssignedUtc = DateTime.UtcNow
        });
        var submitted = NewBooking(setup, VenueBookingStatus.Submitted, setup.Event.StartDate, setup.Event.EndDate);
        db.Add(submitted);
        await db.SaveChangesAsync();

        var result = await new ReviewVenueBookingCommandHandler(db).Handle(
            new ReviewVenueBookingCommand(submitted.Id, setup.Leader.Id, true, string.Empty),
            CancellationToken.None);

        Assert.Equal(Alife.Application.Common.Models.AppResultStatus.Forbidden, result.Status);
        Assert.Equal(VenueBookingStatus.Submitted, (await db.EventVenueBookings.FindAsync(submitted.Id))!.Status);
    }

    [Fact]
    public async Task Member_who_submits_another_leaders_draft_cannot_review_that_submission()
    {
        await using var db = CreateDbContext();
        var setup = await SeedEventAndVenueAsync(db);
        var submittingCoLeader = NewMember();
        AddPermission(db, submittingCoLeader, AdminPermissionCatalog.ReviewVenueBookings, roleId: 506);
        var draft = NewBooking(setup, VenueBookingStatus.Draft, setup.Event.StartDate, setup.Event.EndDate);
        draft.SubmittedUtc = null;
        db.Add(draft);
        await db.SaveChangesAsync();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(setup.Group.Id, submittingCoLeader.Id, Arg.Any<CancellationToken>()).Returns(true);

        var submission = await new SubmitVenueBookingCommandHandler(db, authorization).Handle(
            new SubmitVenueBookingCommand(setup.Event.Id, draft.Id, submittingCoLeader.Id),
            CancellationToken.None);
        var review = await new ReviewVenueBookingCommandHandler(db).Handle(
            new ReviewVenueBookingCommand(draft.Id, submittingCoLeader.Id, true, string.Empty),
            CancellationToken.None);

        Assert.True(submission.IsSuccess);
        Assert.Equal(submittingCoLeader.Id, submission.Value!.SubmittedByMemberId);
        Assert.Equal(Alife.Application.Common.Models.AppResultStatus.Forbidden, review.Status);
        Assert.Equal(VenueBookingStatus.Submitted, (await db.EventVenueBookings.FindAsync(draft.Id))!.Status);
    }

    [Fact]
    public async Task Reviewer_rechecks_maintained_capacity_before_approving()
    {
        await using var db = CreateDbContext();
        var setup = await SeedEventAndVenueAsync(db);
        var reviewer = NewMember();
        AddPermission(db, reviewer, AdminPermissionCatalog.ReviewVenueBookings, roleId: 505);
        var submitted = NewBooking(setup, VenueBookingStatus.Submitted, setup.Event.StartDate, setup.Event.EndDate);
        setup.Space.Capacity = submitted.AttendeeCount - 1;
        db.Add(submitted);
        await db.SaveChangesAsync();

        var result = await new ReviewVenueBookingCommandHandler(db).Handle(
            new ReviewVenueBookingCommand(submitted.Id, reviewer.Id, true, string.Empty),
            CancellationToken.None);

        Assert.Equal(Alife.Application.Common.Models.AppResultStatus.Conflict, result.Status);
        Assert.Equal(VenueBookingStatus.Submitted, (await db.EventVenueBookings.FindAsync(submitted.Id))!.Status);
    }

    private static AlifeDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AlifeDbContext(options);
    }

    private static SaveVenueCommand ValidVenueCommand(Guid churchId, Guid memberId) => new(
        null, churchId, memberId,
        "Church centre", "教会中心", "", "", "1 Church Road", "教会路 1 号", "Pacific/Auckland", true,
        [new SaveVenueSpaceInput(null, "Main hall", "主礼堂", 100, "[\"projector\"]", "{}", true)]);

    private static void AddPermission(AlifeDbContext db, Member member, string permission, int roleId)
    {
        var role = new PlatformRole
        {
            Id = roleId,
            Code = $"test_role_{roleId}",
            NameJson = "{}",
            PermissionsJson = AdminPermissionCatalog.WritePermissions([permission]),
            Level = 1
        };
        db.AddRange(member, role, new MemberPlatformRole
        {
            Id = Guid.NewGuid(), MemberId = member.Id, RoleId = role.Id, AssignedUtc = DateTime.UtcNow
        });
    }

    private static async Task<TestSetup> SeedEventAndVenueAsync(AlifeDbContext db)
    {
        var church = NewChurch();
        var group = NewGroup(church.Id);
        var leader = NewMember();
        var groupEvent = NewEvent(group.Id, leader.Id);
        var venue = NewVenue(church.Id, leader.Id, true);
        var space = NewSpace(venue.Id, "Main hall", true);
        space.Capacity = 100;
        venue.Spaces.Add(space);
        db.AddRange(church, group, leader, groupEvent, venue);
        await db.SaveChangesAsync();
        return new TestSetup(church, group, leader, groupEvent, venue, space);
    }

    private static SaveEventVenueBookingCommand NewBookingCommand(TestSetup setup, int attendeeCount) => new(
        setup.Event.Id, null, setup.Leader.Id, null, setup.Space.Id,
        "Sunday gathering", "主日聚会", "", setup.Event.StartDate, setup.Event.EndDate, attendeeCount);

    private static EventVenueBooking NewBooking(TestSetup setup, VenueBookingStatus status, DateTime start, DateTime end) => new()
    {
        Id = Guid.NewGuid(), EventId = setup.Event.Id, VenueSpaceId = setup.Space.Id,
        RequestedByMemberId = setup.Leader.Id, PurposeEn = "Gathering", PurposeZh = "聚会",
        StartUtc = start, EndUtc = end, AttendeeCount = 60, Status = status,
        SubmittedUtc = DateTime.UtcNow, CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
    };

    private static Group NewChurch() => new()
    {
        Id = Guid.NewGuid(), NameJson = "{\"en\":\"Church\",\"zh\":\"教会\"}", IsChurch = true,
        CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
    };

    private static Group NewGroup(Guid churchId) => new()
    {
        Id = Guid.NewGuid(), ParentGroupId = churchId, NameJson = "{\"en\":\"Group\",\"zh\":\"小组\"}",
        CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
    };

    private static Member NewMember() => new()
    {
        Id = Guid.NewGuid(), DisplayName = "Member", IsRegistered = true,
        CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
    };

    private static GroupEvent NewEvent(Guid groupId, Guid memberId) => new()
    {
        Id = Guid.NewGuid(), GroupId = groupId, CreatedByMemberId = memberId,
        TitleEn = "Event", TitleZh = "活动", StartDate = DateTime.UtcNow.AddDays(10), EndDate = DateTime.UtcNow.AddDays(10).AddHours(3),
        EventDataJson = "{\"visibility\":\"groupVisible\",\"enabledModules\":[\"venue\"]}", CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
    };

    private static Venue NewVenue(Guid churchId, Guid memberId, bool active) => new()
    {
        Id = Guid.NewGuid(), ChurchGroupId = churchId, CreatedByMemberId = memberId, UpdatedByMemberId = memberId,
        NameEn = "Centre", NameZh = "中心", TimeZoneId = "Pacific/Auckland", IsActive = active,
        CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
    };

    private static VenueSpace NewSpace(Guid venueId, string name, bool active) => new()
    {
        Id = Guid.NewGuid(), VenueId = venueId, NameEn = name, NameZh = name, Capacity = 20,
        ResourcesJson = "[]", BookingPolicyJson = "{}", IsActive = active,
        CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
    };

    private sealed record TestSetup(Group Church, Group Group, Member Leader, GroupEvent Event, Venue Venue, VenueSpace Space);
}
