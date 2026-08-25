using Alife.Application.Common.Models;
using Alife.Application.Events.Commands.SaveEventProgrammeItem;
using Alife.Application.Events.Queries.GetEventProgramme;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.Events;

public sealed class EventProgrammeWorkflowTests
{
    [Fact]
    public async Task Programme_is_opt_in_and_cannot_be_edited_when_the_module_is_missing()
    {
        await using var db = CreateDbContext();
        var setup = await SeedAsync(db, programmeEnabled: false);

        var result = await Save(db, setup, Status: EventProgrammeItemStatus.Draft);

        Assert.Equal(AppResultStatus.Conflict, result.Status);
        Assert.Empty(await db.EventProgrammeItems.ToListAsync());
    }

    [Fact]
    public async Task Ready_item_requires_an_owner_and_required_handover_notes()
    {
        await using var db = CreateDbContext();
        var setup = await SeedAsync(db, programmeEnabled: true);

        var missingOwner = await Save(db, setup, Status: EventProgrammeItemStatus.Ready);
        var missingHandover = await Save(db, setup, OwnerMemberId: setup.Worker.Id, RequiresHandover: true, Status: EventProgrammeItemStatus.Ready);
        var ready = await Save(db, setup, OwnerMemberId: setup.Worker.Id, RequiresHandover: true,
            HandoverZh: "把无线麦克风和钥匙交给下一班。", Status: EventProgrammeItemStatus.Ready);

        Assert.Equal(AppResultStatus.ValidationError, missingOwner.Status);
        Assert.Equal(AppResultStatus.ValidationError, missingHandover.Status);
        Assert.True(ready.IsSuccess);
        Assert.True(ready.Value!.CanBeReady);
        Assert.Equal(EventProgrammeItemStatus.Ready, ready.Value.Status);
        Assert.Equal("Worker", ready.Value.OwnerDisplayName);
        Assert.Contains(await db.AuditLogs.ToListAsync(), x => x.Action == "event.programme.item.created");
    }

    [Fact]
    public async Task Accepted_roster_assignment_can_own_a_programme_item_without_copying_the_roster()
    {
        await using var db = CreateDbContext();
        var setup = await SeedAsync(db, programmeEnabled: true);
        var shift = new EventRosterShift
        {
            Id = Guid.NewGuid(), EventId = setup.Event.Id, RoleKey = "welcome", NameEn = "Welcome", NameZh = "接待",
            StartUtc = setup.Event.StartDate, EndUtc = setup.Event.StartDate.AddMinutes(30), RequiredPeople = 1,
            RequiredLabelsJson = "[]", Notes = string.Empty, CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
        };
        shift.Assignments.Add(new EventRosterAssignment
        {
            Id = Guid.NewGuid(), ShiftId = shift.Id, MemberId = setup.Worker.Id, ConfirmedByMemberId = setup.Leader.Id,
            Status = EventRosterAssignmentStatus.Accepted, ConfirmedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
        });
        db.EventRosterShifts.Add(shift);
        await db.SaveChangesAsync();

        var saved = await Save(db, setup, RosterShiftId: shift.Id, RequiresHandover: true,
            HandoverEn: "Pass the welcome list to the registration desk.", Status: EventProgrammeItemStatus.Ready);
        var workspace = await new GetEventProgrammeQueryHandler(db, Authorization(setup)).Handle(
            new GetEventProgrammeQuery(setup.Event.Id, setup.Leader.Id), CancellationToken.None);

        Assert.True(saved.IsSuccess);
        Assert.Null(saved.Value!.OwnerMemberId);
        Assert.Single(saved.Value.Roster!.Assignees);
        Assert.Equal(EventRosterAssignmentStatus.Accepted, saved.Value.Roster.Assignees[0].Status);
        Assert.True(workspace.IsSuccess);
        Assert.Equal(EventModuleStatus.Ready, workspace.Value!.Status);
        Assert.Single(workspace.Value.Items);
        Assert.Single(workspace.Value.RosterOptions);
    }

    private static Task<AppResult<Alife.Application.Events.Dtos.EventProgrammeItemDto>> Save(
        AlifeDbContext db,
        Setup setup,
        Guid? OwnerMemberId = null,
        Guid? RosterShiftId = null,
        bool RequiresHandover = false,
        string HandoverEn = "",
        string HandoverZh = "",
        EventProgrammeItemStatus Status = EventProgrammeItemStatus.Draft) =>
        new SaveEventProgrammeItemCommandHandler(db, Authorization(setup)).Handle(new SaveEventProgrammeItemCommand(
            setup.Event.Id, null, setup.Leader.Id, setup.Event.Plan!.Occurrences.Single().Id,
            RosterShiftId, OwnerMemberId, 10, setup.Event.StartDate, setup.Event.StartDate.AddMinutes(30),
            "Welcome", "接待", "Open the doors and prepare name tags.", "开门并准备名牌。",
            RequiresHandover, HandoverEn, HandoverZh, Status), CancellationToken.None);

    private static IGroupAuthorizationService Authorization(Setup setup)
    {
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(setup.Group.Id, setup.Leader.Id, Arg.Any<CancellationToken>()).Returns(true);
        authorization.IsLeaderOrCoLeaderAsync(setup.Group.Id, setup.Worker.Id, Arg.Any<CancellationToken>()).Returns(false);
        return authorization;
    }

    private static async Task<Setup> SeedAsync(AlifeDbContext db, bool programmeEnabled)
    {
        var leader = Member("Leader"); var worker = Member("Worker");
        var group = new Group { Id = Guid.NewGuid(), NameJson = "{}", CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow };
        var modules = programmeEnabled ? "[\"programme\",\"roster\"]" : "[]";
        var groupEvent = new GroupEvent
        {
            Id = Guid.NewGuid(), GroupId = group.Id, CreatedByMemberId = leader.Id,
            TitleEn = "Community dinner", TitleZh = "社区晚餐",
            StartDate = DateTime.UtcNow.AddDays(5), EndDate = DateTime.UtcNow.AddDays(5).AddHours(4),
            EventDataJson = $"{{\"visibility\":\"groupVisible\",\"enabledModules\":{modules}}}",
            CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
        };
        groupEvent.Plan = EventCompositionFactory.CreateInitial(groupEvent, leader.Id, null, DateTime.UtcNow);
        db.AddRange(group, leader, worker, groupEvent,
            new GroupMembership { Id = Guid.NewGuid(), GroupId = group.Id, MemberId = leader.Id, Status = MembershipStatus.Approved, Role = MembershipRole.Leader, CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow },
            new GroupMembership { Id = Guid.NewGuid(), GroupId = group.Id, MemberId = worker.Id, Status = MembershipStatus.Approved, Role = MembershipRole.Member, CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow });
        await db.SaveChangesAsync();
        return new(group, leader, worker, groupEvent);
    }

    private static Member Member(string name) => new()
    {
        Id = Guid.NewGuid(), DisplayName = name, IsRegistered = true,
        CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
    };

    private static AlifeDbContext CreateDbContext() => new(new DbContextOptionsBuilder<AlifeDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
    private sealed record Setup(Group Group, Member Leader, Member Worker, GroupEvent Event);
}
