using System.Text.Json;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.Events;

public sealed partial class EventOperationsCoreTests
{
    private static async Task<(GroupEvent Event, Guid Owner, Guid Assignee, Guid Reviewer, EventOperationsService Service, EventDutyProjectionService Duties)> TaskFixture(AlifeDbContext db)
    {
        var owner = Guid.NewGuid(); var assignee = Guid.NewGuid(); var reviewer = Guid.NewGuid();
        var e = SeedEvent(db, Guid.NewGuid(), owner);
        db.Groups.Add(new Group { Id = e.GroupId, NameJson = "{}" });
        foreach (var person in new[] { owner, assignee, reviewer })
        {
            db.Members.Add(Member(person, person.ToString()));
            db.GroupMemberships.Add(new() { Id = Guid.NewGuid(), GroupId = e.GroupId, MemberId = person, Status = MembershipStatus.Approved });
            if (person != owner) db.EventTeamMembers.Add(new() { Id = Guid.NewGuid(), EventId = e.Id, MemberId = person, Status = EventTeamMemberStatus.Accepted });
        }
        await db.SaveChangesAsync();
        var auth = Authorization(owner);
        auth.IsApprovedMemberAsync(e.GroupId, Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(call => db.GroupMemberships.Any(x => x.GroupId == e.GroupId && x.MemberId == call.ArgAt<Guid>(1) && x.Status == MembershipStatus.Approved));
        var packages = Substitute.For<IEventPackageService>();
        packages.ListDutiesAsync(Arg.Any<Guid>(), Arg.Any<IReadOnlyList<GroupEvent>>(), Arg.Any<CancellationToken>()).Returns(Array.Empty<EventDuty>());
        return (e, owner, assignee, reviewer, new(db, auth), new(db, packages));
    }

    private static UpdateEventTaskRequest Update(EventTaskDto t, EventTaskStatus status, Guid? assignee = null, Guid? reviewer = null)
        => new(t.Title, t.Description, assignee ?? t.AssignedMemberId, t.DueUtc, status, t.IsRequired, t.RequiresApproval, t.IsRestricted, reviewer ?? t.ReviewerMemberId);

    [Fact]
    public async Task RosterQualificationRevocation_RemovesInvitationAndRejectsConfirmation()
    {
        await using var db = CreateDb(); var f = await TaskFixture(db);
        var occurrence = new EventOccurrence { Id = Guid.NewGuid(), EventId = f.Event.Id, StartUtc = f.Event.StartDate, EndUtc = f.Event.EndDate };
        var slot = new EventServiceSlot { Id = Guid.NewGuid(), OccurrenceId = occurrence.Id, RoleCode = "welcome", EligibilityCode = "acceptedRole:welcome", StartUtc = f.Event.StartDate, EndUtc = f.Event.EndDate, RequiredCount = 1 };
        var role = new EventRoleAssignment { Id = Guid.NewGuid(), EventId = f.Event.Id, MemberId = f.Assignee, RoleRequirementKey = "TEAM.WORK:welcome", Status = EventRoleAssignmentStatus.Accepted };
        var assignment = new EventRosterAssignment { Id = Guid.NewGuid(), ServiceSlotId = slot.Id, MemberId = f.Assignee, Status = EventRosterAssignmentStatus.Invited };
        db.EventOccurrences.Add(occurrence); db.EventServiceSlots.Add(slot); db.EventRoleAssignments.Add(role); db.EventRosterAssignments.Add(assignment);
        await db.SaveChangesAsync();
        Assert.Single(await f.Duties.ListAsync(f.Assignee, default));
        role.EndedUtc = DateTime.UtcNow; await db.SaveChangesAsync();
        Assert.Empty(await f.Duties.ListAsync(f.Assignee, default));
        Assert.Equal(AppResultStatus.Forbidden, (await f.Service.RespondToRosterAssignmentAsync(f.Event.Id, occurrence.Id, assignment.Id, f.Assignee, true, default)).Status);
        Assert.Equal(EventRosterAssignmentStatus.Invited, assignment.Status);
    }

    [Fact]
    public async Task RemovedOwner_CannotConfigureOrCancelTasks_AndGetsNoDuty()
    {
        await using var db = CreateDb(); var f = await TaskFixture(db);
        var created = await f.Service.CreateTaskAsync(f.Event.Id, f.Owner, new(new("Follow up", "跟进"), null, f.Owner, null), default);
        Assert.True(created.IsSuccess, created.Message); var task = created.Value!;
        db.GroupMemberships.Single(x => x.MemberId == f.Owner).Status = MembershipStatus.Removed;
        await db.SaveChangesAsync();
        Assert.Empty(await f.Duties.ListAsync(f.Owner, default));
        Assert.Equal(AppResultStatus.Forbidden, (await f.Service.GetTaskAsync(f.Event.Id, task.Id, f.Owner, default)).Status);
        Assert.Equal(AppResultStatus.Forbidden, (await f.Service.CreateTaskAsync(f.Event.Id, f.Owner, new(new("Another", "另一项"), null, null, null), default)).Status);
        Assert.Equal(AppResultStatus.Forbidden, (await f.Service.CancelTaskAsync(f.Event.Id, task.Id, f.Owner, task.ETag, default)).Status);
        Assert.Equal(AppResultStatus.Forbidden, (await f.Service.AddTaskDependencyAsync(f.Event.Id, task.Id, f.Owner, new(Guid.NewGuid()), default)).Status);
        Assert.Equal(AppResultStatus.Forbidden, (await f.Service.RemoveTaskDependencyAsync(f.Event.Id, task.Id, Guid.NewGuid(), f.Owner, default)).Status);
        Assert.Equal(EventTaskStatus.Todo, (await db.EventTasks.SingleAsync()).Status);
    }

    [Fact]
    public async Task CompletionApproval_HandsOffWithoutNotifications_ReadsNeverComplete_AndReturnPreservesRounds()
    {
        await using var db = CreateDb(); var f = await TaskFixture(db);
        var created = await f.Service.CreateTaskAsync(f.Event.Id, f.Owner, new(new("Prepare chairs", "准备座椅"), null, f.Assignee, null, RequiresApproval: true, ReviewerMemberId: f.Reviewer), default);
        Assert.True(created.IsSuccess, created.Message); var task = created.Value!;
        Assert.Empty(await db.NotificationMessages.ToListAsync());
        var initial = Assert.Single(await f.Duties.ListAsync(f.Assignee, default));
        Assert.Equal("workflow", initial.Task.CompletionMode);
        Assert.True((await f.Duties.GetAsync(f.Event.Id, "eventTask", task.Id, f.Assignee, initial.Task.TaskKey, default)).IsSuccess);
        Assert.Single(await f.Duties.ListAsync(f.Assignee, default));
        Assert.Empty(await f.Duties.ListAsync(f.Reviewer, default));
        var submitted = await f.Service.ActOnTaskAsync(f.Event.Id, task.Id, f.Assignee, "submit-completion", new(), task.ETag, "submission-1", default);
        Assert.True(submitted.IsSuccess, submitted.Message);
        Assert.Empty(await f.Duties.ListAsync(f.Assignee, default));
        Assert.Equal("event.task.review", Assert.Single(await f.Duties.ListAsync(f.Reviewer, default)).Task.ActionType);
        Assert.Equal(AppResultStatus.Conflict, (await f.Duties.GetAsync(f.Event.Id, "eventTask", task.Id, f.Assignee, initial.Task.TaskKey, default)).Status);
        var returned = await f.Service.ActOnTaskAsync(f.Event.Id, task.Id, f.Reviewer, "return", new("Please count the chairs"), submitted.Value!.Task.ETag, "return-1", default);
        Assert.True(returned.IsSuccess, returned.Message);
        Assert.Equal(EventTaskApprovalStatus.Returned, returned.Value!.Task.ApprovalStatus);
        Assert.Single(await f.Duties.ListAsync(f.Assignee, default)); Assert.Empty(await f.Duties.ListAsync(f.Reviewer, default));
        var second = await f.Service.ActOnTaskAsync(f.Event.Id, task.Id, f.Assignee, "submit-completion", new(), returned.Value.Task.ETag, "submission-2", default);
        var approved = await f.Service.ActOnTaskAsync(f.Event.Id, task.Id, f.Reviewer, "approve", new(), second.Value!.Task.ETag, "approve-2", default);
        Assert.True(approved.IsSuccess, approved.Message); Assert.Equal(EventTaskStatus.Done, approved.Value!.Task.Status);
        Assert.Equal(2, approved.Value.Task.ApprovalRound); Assert.Equal(4, approved.Value.History.Count);
        Assert.Equal("Please count the chairs", approved.Value.History.Single(x => x.Action == "return").Reason);
        using var snapshot = JsonDocument.Parse(approved.Value.History.First(x => x.Action == "submit-completion").SnapshotJson);
        Assert.Equal(f.Assignee, snapshot.RootElement.GetProperty("assignedMemberId").GetGuid());
        Assert.Empty(await f.Duties.ListAsync(f.Assignee, default)); Assert.Empty(await f.Duties.ListAsync(f.Reviewer, default));
    }

    [Fact]
    public async Task Approval_RejectsSelfReviewDirectDoneOutsidersStaleAndDuplicateDecisions()
    {
        await using var db = CreateDb(); var f = await TaskFixture(db);
        Assert.Equal(AppResultStatus.ValidationError, (await f.Service.CreateTaskAsync(f.Event.Id, f.Owner, new(new("Task", "任务"), null, f.Assignee, null, RequiresApproval: true, ReviewerMemberId: f.Assignee), default)).Status);
        var t = (await f.Service.CreateTaskAsync(f.Event.Id, f.Owner, new(new("Task", "任务"), null, f.Assignee, null, RequiresApproval: true), default)).Value!;
        Assert.Equal(f.Owner, t.ReviewerMemberId);
        Assert.Equal(AppResultStatus.Conflict, (await f.Service.UpdateTaskAsync(f.Event.Id, t.Id, f.Assignee, Update(t, EventTaskStatus.Done), t.ETag, default)).Status);
        var submitted = (await f.Service.ActOnTaskAsync(f.Event.Id, t.Id, f.Assignee, "submit-completion", new(), t.ETag, "submit-default", default)).Value!;
        Assert.Equal(AppResultStatus.Forbidden, (await f.Service.ActOnTaskAsync(f.Event.Id, t.Id, f.Assignee, "approve", new(), submitted.Task.ETag, "self-approve", default)).Status);
        Assert.Equal(AppResultStatus.Forbidden, (await f.Service.ActOnTaskAsync(f.Event.Id, t.Id, f.Reviewer, "approve", new(), submitted.Task.ETag, "other-approve", default)).Status);
        Assert.Equal(AppResultStatus.PreconditionFailed, (await f.Service.ActOnTaskAsync(f.Event.Id, t.Id, f.Owner, "approve", new(), t.ETag, "old-version", default)).Status);
        Assert.Equal(AppResultStatus.ValidationError, (await f.Service.ActOnTaskAsync(f.Event.Id, t.Id, f.Owner, "return", new(), submitted.Task.ETag, "empty-return", default)).Status);
        var approved = await f.Service.ActOnTaskAsync(f.Event.Id, t.Id, f.Owner, "approve", new(), submitted.Task.ETag, "approve-once", default);
        Assert.True(approved.IsSuccess);
        Assert.True((await f.Service.ActOnTaskAsync(f.Event.Id, t.Id, f.Owner, "approve", new(), submitted.Task.ETag, "approve-once", default)).IsSuccess);
        Assert.Equal(AppResultStatus.PreconditionFailed, (await f.Service.ActOnTaskAsync(f.Event.Id, t.Id, f.Owner, "return", new("Raced"), submitted.Task.ETag, "race-return", default)).Status);
        Assert.Equal(2, await db.EventTaskApprovalActions.CountAsync());
    }

    [Fact]
    public async Task WithdrawReassignmentAndLeavingGroup_InvalidateCurrentReviewWithoutErasingHistory()
    {
        await using var db = CreateDb(); var f = await TaskFixture(db);
        var t = (await f.Service.CreateTaskAsync(f.Event.Id, f.Owner, new(new("Task", "任务"), null, f.Assignee, null, RequiresApproval: true, ReviewerMemberId: f.Reviewer), default)).Value!;
        var first = (await f.Service.ActOnTaskAsync(f.Event.Id, t.Id, f.Assignee, "submit-completion", new(), t.ETag, "submit-withdraw", default)).Value!;
        var withdrawn = (await f.Service.ActOnTaskAsync(f.Event.Id, t.Id, f.Assignee, "withdraw-completion", new(), first.Task.ETag, "withdraw-first", default)).Value!;
        Assert.Equal(EventTaskApprovalStatus.NotSubmitted, withdrawn.Task.ApprovalStatus);
        var second = (await f.Service.ActOnTaskAsync(f.Event.Id, t.Id, f.Assignee, "submit-completion", new(), withdrawn.Task.ETag, "submit-again", default)).Value!;
        var reassigned = await f.Service.UpdateTaskAsync(f.Event.Id, t.Id, f.Owner, Update(second.Task, EventTaskStatus.InProgress, reviewer: f.Owner), second.Task.ETag, default);
        Assert.True(reassigned.IsSuccess, reassigned.Message); Assert.Equal(EventTaskApprovalStatus.NotSubmitted, reassigned.Value!.ApprovalStatus);
        Assert.Empty(await f.Duties.ListAsync(f.Reviewer, default));
        Assert.Equal(AppResultStatus.Forbidden, (await f.Service.ActOnTaskAsync(f.Event.Id, t.Id, f.Reviewer, "approve", new(), second.Task.ETag, "former-reviewer", default)).Status);
        db.GroupMemberships.Single(x => x.MemberId == f.Assignee).Status = MembershipStatus.Removed; await db.SaveChangesAsync();
        Assert.Empty(await f.Duties.ListAsync(f.Assignee, default));
        Assert.Equal(AppResultStatus.Forbidden, (await f.Service.GetTaskAsync(f.Event.Id, t.Id, f.Assignee, default)).Status);
        Assert.Equal(4, await db.EventTaskApprovalActions.CountAsync());
    }

    [Fact]
    public async Task EndedEvent_KeepsOrdinaryTasksAndApprovals_ButSystemTasksCannotBypassSpecialistApproval()
    {
        await using var db = CreateDb(); var f = await TaskFixture(db);
        f.Event.EndDate = DateTime.UtcNow.AddDays(-1); await db.SaveChangesAsync();
        var t = (await f.Service.CreateTaskAsync(f.Event.Id, f.Owner, new(new("Follow up", "善后"), null, f.Assignee, null, RequiresApproval: true), default)).Value!;
        Assert.Single(await f.Duties.ListAsync(f.Assignee, default));
        Assert.True((await f.Service.ActOnTaskAsync(f.Event.Id, t.Id, f.Assignee, "submit-completion", new(), t.ETag, "after-event", default)).IsSuccess);
        var entity = await db.EventTasks.SingleAsync(); entity.SourceType = "packageCondition"; entity.SourceId = Guid.NewGuid(); await db.SaveChangesAsync();
        Assert.Empty(await f.Duties.ListAsync(f.Assignee, default)); Assert.Empty(await f.Duties.ListAsync(f.Owner, default));
        Assert.Equal(AppResultStatus.Conflict, (await f.Service.ActOnTaskAsync(f.Event.Id, t.Id, f.Owner, "approve", new(), entity.ConcurrencyToken.ToString(), "no-bypass", default)).Status);
    }
}
