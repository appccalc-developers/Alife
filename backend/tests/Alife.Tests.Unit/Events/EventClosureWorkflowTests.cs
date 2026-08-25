using Alife.Application.Common.Models;
using Alife.Application.Events.Commands.UpdateEventClosureReport;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Queries.GetEventClosureWorkspace;
using Alife.Application.Events.Queries.GetEventPlan;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.Events;

public sealed class EventClosureWorkflowTests
{
    [Fact]
    public async Task Closure_requires_completed_sections_and_explicit_leader_confirmation()
    {
        await using var db = CreateDbContext();
        var leader = Member("Leader");
        var groupEvent = Event(leader.Id, DateTime.UtcNow.AddHours(-3), DateTime.UtcNow.AddHours(-1));
        db.AddRange(leader, groupEvent);
        await db.SaveChangesAsync();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(groupEvent.GroupId, leader.Id, Arg.Any<CancellationToken>()).Returns(true);
        var handler = new UpdateEventClosureReportCommandHandler(db, authorization);

        var incomplete = await handler.Handle(new UpdateEventClosureReportCommand(
            groupEvent.Id, leader.Id, "Summary", "", "12 attended", "No variance", "None", "Follow up two guests", [], true),
            CancellationToken.None);
        var learningId = Guid.NewGuid();
        var complete = await handler.Handle(new UpdateEventClosureReportCommand(
            groupEvent.Id, leader.Id, "A useful gathering", "一次有收获的聚会", "12 attended", "No variance", "None", "Follow up two guests",
            [new EventClosureLearningDto(learningId, new WorkflowTextDto("Open check-in earlier", "提前开放签到"), new WorkflowTextDto("Open 20 minutes before start.", "开始前二十分钟开放。"), true)], true),
            CancellationToken.None);

        Assert.Equal(AppResultStatus.ValidationError, incomplete.Status);
        Assert.True(complete.IsSuccess);
        Assert.True(complete.Value!.LeaderConfirmed);
        Assert.Equal(leader.Id, complete.Value.ConfirmedByMemberId);
        Assert.Contains(await db.AuditLogs.ToListAsync(), x => x.Action == "event.closure.confirmed");
    }

    [Fact]
    public async Task Past_event_plan_requires_closure_and_completes_only_after_confirmation()
    {
        await using var db = CreateDbContext();
        var leader = Member("Leader");
        var groupEvent = Event(leader.Id, DateTime.UtcNow.AddHours(-3), DateTime.UtcNow.AddHours(-1));
        groupEvent.Plan = EventCompositionFactory.CreateInitial(groupEvent, leader.Id, null, DateTime.UtcNow);
        db.AddRange(leader, groupEvent);
        await db.SaveChangesAsync();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(groupEvent.GroupId, leader.Id, Arg.Any<CancellationToken>()).Returns(true);
        var planHandler = new GetEventPlanQueryHandler(db, authorization);

        var before = await planHandler.Handle(new GetEventPlanQuery(groupEvent.Id, leader.Id), CancellationToken.None);
        await new UpdateEventClosureReportCommandHandler(db, authorization).Handle(new UpdateEventClosureReportCommand(
            groupEvent.Id, leader.Id, "Summary", "总结", "12 attended", "No variance", "None", "No pending follow-up", [], true),
            CancellationToken.None);
        var after = await planHandler.Handle(new GetEventPlanQuery(groupEvent.Id, leader.Id), CancellationToken.None);

        Assert.True(before.IsSuccess);
        Assert.Equal(EventModuleStatus.NotConfigured, before.Value!.Modules.Single(x => x.Key == "closure").Status);
        Assert.Equal(EventPlanStatus.Active, before.Value.Status);
        Assert.Equal(EventModuleStatus.Ready, after.Value!.Modules.Single(x => x.Key == "closure").Status);
        Assert.Equal(EventPlanStatus.Completed, after.Value.Status);
    }

    [Fact]
    public async Task Selected_finance_module_requires_explicit_reconciliation_even_when_no_transactions_occurred()
    {
        await using var db = CreateDbContext();
        var leader = Member("Leader");
        var groupEvent = Event(leader.Id, DateTime.UtcNow.AddHours(-3), DateTime.UtcNow.AddHours(-1));
        groupEvent.EventDataJson = """{"enabledModules":["finance"],"description":{"en":"Event","zh":"活动"}}""";
        groupEvent.Plan = EventCompositionFactory.CreateInitial(groupEvent, leader.Id, null, DateTime.UtcNow);
        db.AddRange(leader, groupEvent);
        await db.SaveChangesAsync();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(groupEvent.GroupId, leader.Id, Arg.Any<CancellationToken>()).Returns(true);
        var handler = new UpdateEventClosureReportCommandHandler(db, authorization);

        var beforeReconciliation = await handler.Handle(CompleteClosure(groupEvent.Id, leader.Id), CancellationToken.None);
        db.EventFinanceReconciliations.Add(new EventFinanceReconciliation
        {
            EventId = groupEvent.Id,
            NotesEn = "No actual transactions.", NotesZh = "没有实际收支。",
            LeaderConfirmed = true, ConfirmedByMemberId = leader.Id,
            ConfirmedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
        var afterReconciliation = await handler.Handle(CompleteClosure(groupEvent.Id, leader.Id), CancellationToken.None);

        Assert.Equal(AppResultStatus.ValidationError, beforeReconciliation.Status);
        Assert.True(afterReconciliation.IsSuccess);
    }

    [Fact]
    public async Task Workspace_exposes_only_leader_adopted_learnings_from_earlier_reports()
    {
        await using var db = CreateDbContext();
        var leader = Member("Leader");
        var current = Event(leader.Id, DateTime.UtcNow.AddHours(-2), DateTime.UtcNow.AddHours(-1));
        var previous = Event(leader.Id, DateTime.UtcNow.AddDays(-31), DateTime.UtcNow.AddDays(-30));
        previous.GroupId = current.GroupId;
        previous.ClosureReport = new EventClosureReport
        {
            EventId = previous.Id, SummaryEn = "Summary", SummaryZh = "总结", AttendanceNotes = "10",
            FinanceNotes = "None", IncidentNotes = "None", FollowUpNotes = "Done", LeaderConfirmed = true,
            ConfirmedByMemberId = leader.Id, ConfirmedUtc = DateTime.UtcNow.AddDays(-29),
            ReusableLearningsJson = EventClosureLearningSerializer.Write([
                new EventClosureLearningDto(Guid.NewGuid(), new WorkflowTextDto("Keep", "保留"), new WorkflowTextDto("Useful", "有用"), true),
                new EventClosureLearningDto(Guid.NewGuid(), new WorkflowTextDto("Do not reuse", "不复用"), new WorkflowTextDto("One-off", "一次性"), false)
            ]), CreatedUtc = DateTime.UtcNow.AddDays(-30), UpdatedUtc = DateTime.UtcNow.AddDays(-29)
        };
        db.AddRange(leader, previous, current);
        await db.SaveChangesAsync();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(current.GroupId, leader.Id, Arg.Any<CancellationToken>()).Returns(true);

        var result = await new GetEventClosureWorkspaceQueryHandler(db, authorization).Handle(
            new GetEventClosureWorkspaceQuery(current.Id, leader.Id), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var learning = Assert.Single(result.Value!.PreviousLearnings);
        Assert.Equal("Keep", learning.Learning.Title.En);
    }

    private static AlifeDbContext CreateDbContext() => new(new DbContextOptionsBuilder<AlifeDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private static GroupEvent Event(Guid leaderId, DateTime start, DateTime end) => new()
    {
        Id = Guid.NewGuid(), GroupId = Guid.NewGuid(), CreatedByMemberId = leaderId,
        TitleEn = "Community event", TitleZh = "社区活动", StartDate = start, EndDate = end,
        EventDataJson = "{\"visibility\":\"groupVisible\",\"description\":{\"en\":\"Event\",\"zh\":\"活动\"},\"publicationStatus\":\"published\"}",
        CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
    };

    private static Member Member(string name) => new()
    {
        Id = Guid.NewGuid(), DisplayName = name, IsRegistered = true,
        CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
    };

    private static UpdateEventClosureReportCommand CompleteClosure(Guid eventId, Guid leaderId) => new(
        eventId, leaderId, "Summary", "总结", "No attendance variance", "No finance variance",
        "No incidents", "No pending follow-up", [], true);
}
