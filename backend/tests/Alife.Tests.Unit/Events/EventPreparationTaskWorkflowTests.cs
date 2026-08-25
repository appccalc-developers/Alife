using Alife.Application.Common.Models;
using Alife.Application.Events.Commands.SaveEventPreparationTask;
using Alife.Application.Events.Commands.UpdateEventPreparationTaskStatus;
using Alife.Application.Events.Queries.GetEventPreparationTasks;
using Alife.Application.Events.Queries.GetMyEventPreparationTasks;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.Events;

public sealed class EventPreparationTaskWorkflowTests
{
    [Fact]
    public async Task Dependencies_block_work_until_prerequisites_complete_and_required_tasks_drive_readiness()
    {
        await using var db = CreateDbContext();
        var setup = await SeedAsync(db);
        var authorization = Authorization(setup);
        var save = new SaveEventPreparationTaskCommandHandler(db, authorization);
        var status = new UpdateEventPreparationTaskStatusCommandHandler(db, authorization);
        var first = await save.Handle(Command(setup, "Confirm menu", "确认菜单", []), CancellationToken.None);
        var second = await save.Handle(Command(setup, "Buy food", "采购食物", [first.Value!.Id]), CancellationToken.None);

        var blocked = await status.Handle(new(setup.Event.Id, second.Value!.Id, setup.Worker.Id, EventPreparationTaskStatus.Completed), CancellationToken.None);
        var firstDone = await status.Handle(new(setup.Event.Id, first.Value.Id, setup.Worker.Id, EventPreparationTaskStatus.Completed), CancellationToken.None);
        var secondDone = await status.Handle(new(setup.Event.Id, second.Value.Id, setup.Worker.Id, EventPreparationTaskStatus.Completed), CancellationToken.None);

        Assert.Equal(AppResultStatus.Conflict, blocked.Status);
        Assert.True(firstDone.IsSuccess);
        Assert.True(secondDone.IsSuccess);
        Assert.Equal(EventModuleStatus.Ready, setup.Event.Plan!.Modules.Single(x => x.ModuleKey == "tasks").Status);
        Assert.Equal(2, await db.NotificationMessages.CountAsync(x => x.ActionType == "event.preparation.task.assigned" && x.ReadUtc != null));
    }

    [Fact]
    public async Task Circular_dependencies_are_rejected_and_member_workspace_exposes_only_own_tasks()
    {
        await using var db = CreateDbContext();
        var setup = await SeedAsync(db);
        var authorization = Authorization(setup);
        var save = new SaveEventPreparationTaskCommandHandler(db, authorization);
        var first = await save.Handle(Command(setup, "First", "第一项", []), CancellationToken.None);
        var second = await save.Handle(Command(setup, "Second", "第二项", [first.Value!.Id]), CancellationToken.None);

        var cycle = await save.Handle(Command(setup, "First", "第一项", [second.Value!.Id], first.Value.Id), CancellationToken.None);
        var mine = await new GetMyEventPreparationTasksQueryHandler(db).Handle(
            new GetMyEventPreparationTasksQuery(setup.Event.Id, setup.Worker.Id), CancellationToken.None);

        Assert.Equal(AppResultStatus.ValidationError, cycle.Status);
        Assert.True(mine.IsSuccess);
        Assert.Equal(2, mine.Value!.Count);
        Assert.All(mine.Value, task => Assert.Equal(setup.Worker.Id, task.AssignedMemberId));
    }

    [Fact]
    public async Task Required_tasks_need_an_owner_and_a_pre_event_due_date_before_the_plan_can_be_ready()
    {
        await using var db = CreateDbContext();
        var setup = await SeedAsync(db);
        var save = new SaveEventPreparationTaskCommandHandler(db, Authorization(setup));
        SaveEventPreparationTaskCommand Draft(Guid? id, Guid? assignee, DateTime? dueUtc) => new(
            setup.Event.Id, id, setup.Leader.Id, "general", "Prepare welcome desk", "准备接待台", "", "",
            assignee, dueUtc, true, []);

        var missingPlanning = await save.Handle(Draft(null, null, null), CancellationToken.None);
        var taskModule = setup.Event.Plan!.Modules.Single(x => x.ModuleKey == EventPreparationPlanSync.ModuleKey);
        var taskGate = setup.Event.Plan.ReadinessGates.Single(x => x.GateKey == "tasks.completed");

        Assert.True(missingPlanning.IsSuccess);
        Assert.Equal(EventModuleStatus.Blocked, taskModule.Status);
        Assert.Equal(EventReadinessStatus.Blocked, taskGate.Status);

        var lateDueDate = await save.Handle(Draft(missingPlanning.Value!.Id, setup.Worker.Id, setup.Event.StartDate.AddHours(1)), CancellationToken.None);
        Assert.True(lateDueDate.IsSuccess);
        Assert.Equal(EventModuleStatus.Blocked, taskModule.Status);

        var planned = await save.Handle(Draft(missingPlanning.Value.Id, setup.Worker.Id, setup.Event.StartDate.AddDays(-1)), CancellationToken.None);
        Assert.True(planned.IsSuccess);
        Assert.Equal(EventModuleStatus.Configuring, taskModule.Status);
        Assert.Equal(EventReadinessStatus.Pending, taskGate.Status);
    }

    [Fact]
    public async Task Leader_workspace_exposes_event_deadline_and_orders_assignable_members()
    {
        await using var db = CreateDbContext();
        var setup = await SeedAsync(db);

        var result = await new GetEventPreparationTasksQueryHandler(db, Authorization(setup)).Handle(
            new GetEventPreparationTasksQuery(setup.Event.Id, setup.Leader.Id), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(setup.Event.StartDate, result.Value!.EventStartUtc);
        Assert.Equal(["Leader", "Worker"], result.Value.Members.Select(x => x.DisplayName).ToArray());
    }

    private static SaveEventPreparationTaskCommand Command(
        Setup setup, string en, string zh, IReadOnlyList<Guid> dependencies, Guid? id = null) => new(
        setup.Event.Id, id, setup.Leader.Id, "general", en, zh, "", "", setup.Worker.Id,
        setup.Event.StartDate.AddDays(-1), true, dependencies);

    private static IGroupAuthorizationService Authorization(Setup setup)
    {
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(setup.Group.Id, setup.Leader.Id, Arg.Any<CancellationToken>()).Returns(true);
        authorization.IsLeaderOrCoLeaderAsync(setup.Group.Id, setup.Worker.Id, Arg.Any<CancellationToken>()).Returns(false);
        return authorization;
    }

    private static async Task<Setup> SeedAsync(AlifeDbContext db)
    {
        var leader = Member("Leader");
        var worker = Member("Worker");
        var group = new Group { Id = Guid.NewGuid(), NameJson = "{}", CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow };
        var groupEvent = new GroupEvent
        {
            Id = Guid.NewGuid(), GroupId = group.Id, CreatedByMemberId = leader.Id,
            TitleEn = "Community dinner", TitleZh = "社区晚餐",
            StartDate = DateTime.UtcNow.AddDays(5), EndDate = DateTime.UtcNow.AddDays(5).AddHours(4),
            EventDataJson = "{\"visibility\":\"groupVisible\"}", CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
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
