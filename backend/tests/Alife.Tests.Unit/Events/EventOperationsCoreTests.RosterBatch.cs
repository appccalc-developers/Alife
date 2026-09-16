using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Alife.Tests.Unit.Events;

public sealed partial class EventOperationsCoreTests
{
    [Fact]
    public async Task RosterBatch_VersionOneRequiresPublishedEventAndAcceptedCoordinator()
    {
        await using var db = CreateDb(); var owner = Guid.NewGuid(); var coordinator = Guid.NewGuid(); var candidate = Guid.NewGuid();
        var e = SeedEvent(db, Guid.NewGuid(), owner); e.CollaborationVersion = 1; e.PublicationStatus = EventPublicationStatus.Draft;
        var occurrence = SeedOccurrence(db, e);
        db.Members.AddRange(Member(owner, "Owner"), Member(coordinator, "Coordinator"), Member(candidate, "Candidate"));
        foreach (var id in new[] { coordinator, candidate })
            db.GroupMemberships.Add(new() { Id = Guid.NewGuid(), GroupId = e.GroupId, MemberId = id, Status = MembershipStatus.Approved });
        db.EventRoleAssignments.Add(new() { Id = Guid.NewGuid(), EventId = e.Id, MemberId = coordinator,
            RoleRequirementKey = "SERVICE.ROSTER:roster.coordinator", Status = EventRoleAssignmentStatus.Accepted });
        SeedPlan(db, e, Fact("people.volunteersRequired", true)); await db.SaveChangesAsync();
        var service = new EventOperationsService(db, Authorization(owner));
        var group = (await service.SaveRosterGroupAsync(e.Id, owner, new("welcome", "SERVICE.ROSTER", [candidate]), "\"new\"", default)).Value!;
        var roster = (await service.GetRosterAsync(e.Id, occurrence.Id, owner, default)).Value!;
        roster = (await service.CreateSlotAsync(e.Id, occurrence.Id, owner,
            new(null, null, null, "welcome", occurrence.StartUtc, occurrence.EndUtc, 1, "approvedGroupMember"), roster.ETag, default)).Value!;
        var request = new EventRosterBatchRequest([new(occurrence.Id, roster.Slots.Single().Id, roster.ETag, group.ETag, candidate)]);
        Assert.False((await service.GetRosterPageAsync(e.Id, coordinator, 1, default)).Value!.CanManage);
        Assert.Equal(AppResultStatus.Forbidden, (await service.ApplyRosterBatchAsync(e.Id, coordinator, request, "before-publication", default)).Status);
        e.PublicationStatus = EventPublicationStatus.Published; await db.SaveChangesAsync();
        Assert.False((await service.GetRosterPageAsync(e.Id, owner, 1, default)).Value!.CanManage);
        Assert.True((await service.GetRosterPageAsync(e.Id, coordinator, 1, default)).Value!.CanManage);
        Assert.Equal(AppResultStatus.Forbidden, (await service.ApplyRosterBatchAsync(e.Id, owner, request, "owner-only", default)).Status);
        Assert.True((await service.ApplyRosterBatchAsync(e.Id, coordinator, request, "accepted-coordinator", default)).IsSuccess);
        Assert.Single(db.EventRosterAssignments);
        db.EventRoleAssignments.Single(x => x.MemberId == coordinator).EndedUtc = DateTime.UtcNow; await db.SaveChangesAsync();
        Assert.Equal(AppResultStatus.Forbidden, (await service.GetRosterPageAsync(e.Id, coordinator, 1, default)).Status);
        Assert.Equal(AppResultStatus.Forbidden, (await service.ApplyRosterBatchAsync(e.Id, coordinator, request, "revoked-coordinator", default)).Status);
    }

    [Fact]
    public async Task RosterBatch_ConflictRollsBackAll_AndReplayDoesNotNotifyAgain()
    {
        await using var db = CreateDb(); var owner = Guid.NewGuid(); var a = Guid.NewGuid();
        var e = SeedEvent(db, Guid.NewGuid(), owner); var first = SeedOccurrence(db, e); var second = SeedOccurrence(db, e);
        second.StartUtc = second.StartUtc.AddDays(7); second.EndUtc = second.EndUtc.AddDays(7);
        db.Members.AddRange(Member(owner, "Owner"), Member(a, "A")); SeedPlan(db, e, Fact("people.volunteersRequired", true));
        await db.SaveChangesAsync(); var service = new EventOperationsService(db, Authorization(owner));
        var group = (await service.SaveRosterGroupAsync(e.Id, owner, new("welcome", "SERVICE.ROSTER", [a]), "\"new\"", default)).Value!;
        var rows = new List<EventRosterDto>();
        foreach (var occurrence in new[] { first, second })
        {
            var current = (await service.GetRosterAsync(e.Id, occurrence.Id, owner, default)).Value!;
            rows.Add((await service.CreateSlotAsync(e.Id, occurrence.Id, owner, new(null, null, null, "welcome", occurrence.StartUtc, occurrence.EndUtc, 1, "approvedGroupMember"), current.ETag, default)).Value!);
        }
        var changes = rows.Select(x => new EventRosterBatchChange(x.OccurrenceId, x.Slots.Single().Id, x.ETag, group.ETag, a)).ToArray();
        var failed = await service.ApplyRosterBatchAsync(e.Id, owner, new([changes[0], changes[1] with { OccurrenceETag = "stale" }]), "conflict", default);
        Assert.Equal(AppResultStatus.PreconditionFailed, failed.Status); Assert.Empty(db.EventRosterAssignments); Assert.Empty(db.NotificationMessages);
        var request = new EventRosterBatchRequest(changes);
        var saved = await service.ApplyRosterBatchAsync(e.Id, owner, request, "batch", default);
        Assert.True(saved.IsSuccess, saved.Message); Assert.Equal(2, db.EventRosterAssignments.Count()); Assert.Equal(2, db.NotificationMessages.Count());
        Assert.True((await service.ApplyRosterBatchAsync(e.Id, owner, request, "batch", default)).IsSuccess);
        Assert.Equal(2, db.NotificationMessages.Count());
        Assert.Equal(AppResultStatus.Conflict, (await service.ApplyRosterBatchAsync(e.Id, owner, new([changes[0]]), "batch", default)).Status);
    }

    [Fact]
    public async Task RosterBatch_ApprovedOrdinaryInvitationRequiresSelfResponse_AndReplacementRetainsHistory()
    {
        await using var db = CreateDb(); var owner = Guid.NewGuid(); var a = Guid.NewGuid(); var b = Guid.NewGuid();
        var e = SeedEvent(db, Guid.NewGuid(), owner); var occurrence = SeedOccurrence(db, e);
        db.Members.AddRange(Member(owner, "Owner"), Member(a, "A"), Member(b, "B")); SeedPlan(db, e, Fact("people.volunteersRequired", true));
        foreach (var id in new[] { a, b }) db.GroupMemberships.Add(new() { Id = Guid.NewGuid(), GroupId = e.GroupId, MemberId = id, Status = MembershipStatus.Approved });
        await db.SaveChangesAsync(); var service = new EventOperationsService(db, Authorization(owner), new EventPackageInvalidationService(db));
        await service.SaveRosterGroupAsync(e.Id, owner, new("welcome", "SERVICE.ROSTER", [a, b]), "\"new\"", default);
        var roster = (await service.GetRosterAsync(e.Id, occurrence.Id, owner, default)).Value!;
        roster = (await service.CreateSlotAsync(e.Id, occurrence.Id, owner, new(null, null, null, "welcome", occurrence.StartUtc, occurrence.EndUtc, 1, "approvedGroupMember"), roster.ETag, default)).Value!;
        var package = new EventPackage { Id = Guid.NewGuid(), EventId = e.Id, Status = EventPackageStatus.Approved, ApprovalValidityStatus = EventPackageApprovalValidity.Active, RosterRulesVersion = 2 };
        db.EventPackages.Add(package); await db.SaveChangesAsync();
        var invite = await service.AssignRosterMemberAsync(e.Id, occurrence.Id, roster.Slots[0].Id, owner, new(a), roster.ETag, default);
        Assert.True(invite.IsSuccess, invite.Message);
        var assignment = invite.Value!.Slots[0].Assignments.Single();
        Assert.False(await EventRosterPolicy.IsReadyForExecutionAsync(db, e, occurrence.Id, default));
        Assert.Equal(AppResultStatus.Forbidden, (await service.RespondToRosterAssignmentAsync(e.Id, occurrence.Id, assignment.Id, owner, true, default)).Status);
        Assert.True((await service.RespondToRosterAssignmentAsync(e.Id, occurrence.Id, assignment.Id, a, true, default)).IsSuccess);
        Assert.True(await EventRosterPolicy.IsReadyForExecutionAsync(db, e, occurrence.Id, default));
        Assert.Equal(EventPackageApprovalValidity.Active, package.ApprovalValidityStatus);
        roster = (await service.GetRosterAsync(e.Id, occurrence.Id, owner, default)).Value!;
        Assert.Equal(AppResultStatus.Conflict, (await service.AssignRosterMemberAsync(e.Id, occurrence.Id, roster.Slots[0].Id, owner, new(b), roster.ETag, default)).Status);
        var replacement = await service.AssignRosterMemberAsync(e.Id, occurrence.Id, roster.Slots[0].Id, owner, new(b, assignment.Id), roster.ETag, default);
        Assert.True(replacement.IsSuccess, replacement.Message);
        Assert.Equal(2, db.EventRosterAssignments.Count()); Assert.False(await EventRosterPolicy.IsReadyForExecutionAsync(db, e, occurrence.Id, default));
        Assert.Contains(db.NotificationMessages, x => x.RecipientMemberId == a && x.ActionType == "event.roster.ended");
        Assert.Contains(db.NotificationMessages, x => x.RecipientMemberId == owner && x.ActionType == "event.roster.confirmed");
        Assert.Equal(AppResultStatus.Conflict, (await service.RespondToRosterAssignmentAsync(e.Id, occurrence.Id, assignment.Id, a, true, default)).Status);
        Assert.Equal(AppResultStatus.Conflict, (await service.SaveRosterGroupAsync(e.Id, owner, new("welcome", "SERVICE.ROSTER", [b]), (await service.GetRosterGroupsAsync(e.Id, owner, default)).Value![0].ETag, default)).Status);
    }

    [Theory]
    [InlineData("ram.author", "approvedGroupMember")]
    [InlineData("welcome", "unknownQualification")]
    [InlineData("welcome", "acceptedRole:ram.onsite")]
    [InlineData("event.lead", "approvedGroupMember")]
    [InlineData("transport.coordinator", "approvedGroupMember")]
    public void CriticalRosterRulesFailClosed(string role, string qualification) => Assert.True(EventRosterPolicy.IsCritical(role, qualification));
}
