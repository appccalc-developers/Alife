using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Alife.Tests.Unit.Events;

public sealed partial class EventOperationsCoreTests
{
    [Fact]
    public async Task Delegation_RequiresPersonalAcceptanceAndPreparation_AndHandsOffCurrentDuty()
    {
        await using var db = CreateDb(); var f = await TaskFixture(db);
        var created = await f.Service.CreateTaskAsync(f.Event.Id, f.Owner, new(new("Prepare welcome", "准备迎新"), new("Count chairs", "清点椅子"), f.Assignee, null, IsRequired: true, RequireAcceptance: true), default);
        Assert.True(created.IsSuccess, created.Message); var t = created.Value!;
        Assert.Equal("invited", t.AssignmentStatus);
        Assert.Contains((await f.Service.GetTeamAsync(f.Event.Id, f.Owner, default)).Value!.ReadinessBlockers, blocker => blocker.En.Contains("acceptance and preparation"));
        Assert.Contains(await f.Duties.ListAsync(f.Assignee, default), d => d.Task.ActionType == "event.task.respond");
        Assert.Equal(AppResultStatus.Conflict, (await f.Service.UpdateTaskAsync(f.Event.Id, t.Id, f.Assignee, Update(t, EventTaskStatus.Done), t.ETag, default)).Status);
        Assert.Equal(AppResultStatus.Forbidden, (await f.Service.ActOnTaskAsync(f.Event.Id, t.Id, f.Owner, "accept-assignment", new(), t.ETag, "owner-accept", default)).Status);
        var accepted = await f.Service.ActOnTaskAsync(f.Event.Id, t.Id, f.Assignee, "accept-assignment", new(), t.ETag, "personal-accept", default);
        Assert.True(accepted.IsSuccess, accepted.Message);
        Assert.True((await f.Service.ActOnTaskAsync(f.Event.Id, t.Id, f.Assignee, "accept-assignment", new(), t.ETag, "personal-accept", default)).IsSuccess);
        Assert.Equal(AppResultStatus.PreconditionFailed, (await f.Service.ActOnTaskAsync(f.Event.Id, t.Id, f.Assignee, "decline-assignment", new(), t.ETag, "stale-decline", default)).Status);
        t = accepted.Value!.Task;
        Assert.True(accepted.Value.CanPrepare); Assert.False(accepted.Value.CanRespond);
        Assert.Equal(AppResultStatus.Conflict, (await f.Service.UpdateTaskAsync(f.Event.Id, t.Id, f.Assignee, Update(t, EventTaskStatus.Done), t.ETag, default)).Status);
        var prepared = await f.Service.ActOnTaskAsync(f.Event.Id, t.Id, f.Assignee, "save-preparation", new(Preparation: new("Twenty chairs ready", "二十把椅子已备妥")), t.ETag, "save-preparation", default);
        Assert.True(prepared.IsSuccess, prepared.Message);
        Assert.Equal("二十把椅子已备妥", prepared.Value!.Task.Preparation!.Zh);
        Assert.DoesNotContain((await f.Service.GetTeamAsync(f.Event.Id, f.Owner, default)).Value!.ReadinessBlockers, blocker => blocker.En.Contains("acceptance and preparation"));
        Assert.True((await f.Service.UpdateTaskAsync(f.Event.Id, t.Id, f.Assignee, Update(prepared.Value.Task, EventTaskStatus.Done), prepared.Value.Task.ETag, default)).IsSuccess);
        Assert.DoesNotContain(await f.Duties.ListAsync(f.Assignee, default), d => d.Task.SourceId == t.Id);
    }

    [Fact]
    public async Task DeclinedDelegation_ReturnsToOwner_ReassignmentRequiresFreshAcceptance()
    {
        await using var db = CreateDb(); var f = await TaskFixture(db);
        var t = (await f.Service.CreateTaskAsync(f.Event.Id, f.Owner, new(new("Task", "任务"), null, f.Assignee, null, RequireAcceptance: true), default)).Value!;
        var declined = await f.Service.ActOnTaskAsync(f.Event.Id, t.Id, f.Assignee, "decline-assignment", new(), t.ETag, "decline-task", default);
        Assert.True(declined.IsSuccess, declined.Message); t = declined.Value!.Task;
        Assert.DoesNotContain(await f.Duties.ListAsync(f.Assignee, default), d => d.Task.ActionType.StartsWith("event.task."));
        Assert.Contains(await f.Duties.ListAsync(f.Owner, default), d => d.Task.ActionType == "event.task.reassign");
        var reassigned = await f.Service.UpdateTaskAsync(f.Event.Id, t.Id, f.Owner, Update(t, EventTaskStatus.Todo, f.Reviewer), t.ETag, default);
        Assert.True(reassigned.IsSuccess, reassigned.Message);
        Assert.Equal("invited", reassigned.Value!.AssignmentStatus); Assert.Null(reassigned.Value.AssignmentRespondedUtc);
        Assert.Contains(await f.Duties.ListAsync(f.Reviewer, default), d => d.Task.ActionType == "event.task.respond");
    }

    [Fact]
    public async Task PreparationPublication_IsOwnerSelected_BilingualUnrestricted_AndClearedOnRevision()
    {
        await using var db = CreateDb(); var f = await TaskFixture(db);
        var t = (await f.Service.CreateTaskAsync(f.Event.Id, f.Owner, new(new("Task", "任务"), null, f.Assignee, null), default)).Value!;
        var prepared = await f.Service.ActOnTaskAsync(f.Event.Id, t.Id, f.Assignee, "save-preparation", new(Preparation: new("Ready", "已准备")), t.ETag, "save-bilingual", default);
        Assert.True(prepared.IsSuccess, prepared.Message); t = prepared.Value!.Task;
        Assert.Equal(AppResultStatus.Forbidden, (await f.Service.ActOnTaskAsync(f.Event.Id, t.Id, f.Assignee, "select-publication", new(PublicationCandidate: true), t.ETag, "self-selection", default)).Status);
        var sourceToken = (await db.EventTasks.SingleAsync()).ConcurrencyToken;
        var selected = await f.Service.ActOnTaskAsync(f.Event.Id, t.Id, f.Owner, "select-publication", new(PublicationCandidate: true), t.ETag, "owner-selection", default);
        Assert.True(selected.IsSuccess, selected.Message); Assert.True(selected.Value!.Task.PreparationPublicationCandidate);
        Assert.Equal(sourceToken, (await db.EventTasks.SingleAsync()).ConcurrencyToken);
        Assert.NotEqual(t.ETag, selected.Value.Task.ETag);
        Assert.Equal(AppResultStatus.PreconditionFailed, (await f.Service.ActOnTaskAsync(f.Event.Id, t.Id, f.Owner, "select-publication", new(PublicationCandidate: false), t.ETag, "stale-selection", default)).Status);
        var revision = await f.Service.ActOnTaskAsync(f.Event.Id, t.Id, f.Assignee, "save-preparation", new(Preparation: new("Changed", "")), selected.Value.Task.ETag, "revise-preparation", default);
        Assert.True(revision.IsSuccess, revision.Message); Assert.False(revision.Value!.Task.PreparationPublicationCandidate);
        Assert.Equal(AppResultStatus.ValidationError, (await f.Service.ActOnTaskAsync(f.Event.Id, t.Id, f.Owner, "select-publication", new(PublicationCandidate: true), revision.Value.Task.ETag, "missing-language", default)).Status);
        db.GroupMemberships.Single(x => x.MemberId == f.Assignee).Status = MembershipStatus.Removed; await db.SaveChangesAsync();
        Assert.Equal(AppResultStatus.Forbidden, (await f.Service.GetTaskAsync(f.Event.Id, t.Id, f.Assignee, default)).Status);
        Assert.Equal(AppResultStatus.Forbidden, (await f.Service.ActOnTaskAsync(f.Event.Id, t.Id, f.Assignee, "save-preparation", new(Preparation: new("Other", "其他")), revision.Value.Task.ETag, "removed-member", default)).Status);
    }

    [Fact]
    public async Task RestrictedPreparation_CannotBeSelected_AndLegacyUpdatesPreserveBilingualNotes()
    {
        await using var db = CreateDb(); var f = await TaskFixture(db);
        var t = (await f.Service.CreateTaskAsync(f.Event.Id, f.Owner, new(new("Task", "任务"), null, f.Assignee, null, IsRestricted: true), default)).Value!;
        Assert.Equal("accepted", t.AssignmentStatus);
        var prepared = await f.Service.ActOnTaskAsync(f.Event.Id, t.Id, f.Assignee, "save-preparation", new(Preparation: new("Private note", "内部说明")), t.ETag, "restricted-notes", default);
        Assert.True(prepared.IsSuccess, prepared.Message); t = prepared.Value!.Task;
        Assert.Equal(AppResultStatus.ValidationError, (await f.Service.ActOnTaskAsync(f.Event.Id, t.Id, f.Owner, "select-publication", new(PublicationCandidate: true), t.ETag, "select-restricted", default)).Status);
        Assert.DoesNotContain((await f.Service.GetTeamAsync(f.Event.Id, f.Reviewer, default)).Value!.Tasks, x => x.Id == t.Id);
        Assert.Equal(AppResultStatus.Conflict, (await f.Service.UpdateTaskAsync(f.Event.Id, t.Id, f.Owner, Update(t, EventTaskStatus.Done, f.Reviewer), t.ETag, default)).Status);
        var updated = await f.Service.UpdateTaskAsync(f.Event.Id, t.Id, f.Assignee, Update(t, EventTaskStatus.Done), t.ETag, default);
        Assert.True(updated.IsSuccess, updated.Message);
        Assert.Equal(t.Preparation, updated.Value!.Preparation);
        Assert.Equal(t.Stage, updated.Value.Stage); Assert.Equal(t.EventOccurrenceId, updated.Value.EventOccurrenceId);
    }
}
