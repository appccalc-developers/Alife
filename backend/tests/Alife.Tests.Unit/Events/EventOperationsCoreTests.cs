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
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Tests.Unit.Events;

public sealed partial class EventOperationsCoreTests
{
    [Fact]
    public async Task RosterChanges_AuditOwningModule_AndBothSidesOfCandidateGroupMove()
    {
        await using var db = CreateDb();
        var owner = Guid.NewGuid(); var e = SeedEvent(db, Guid.NewGuid(), owner); var occurrence = SeedOccurrence(db, e);
        db.Members.Add(Member(owner, "Owner"));
        SeedPlan(db, e, Fact("people.volunteersRequired", true), Fact("programme.productionRequired", true), Fact("place.resourcesRequired", true));
        await db.SaveChangesAsync();
        var service = new EventOperationsService(db, Authorization(owner), new EventPackageInvalidationService(db));
        var initial = (await service.GetRosterAsync(e.Id, occurrence.Id, owner, default)).Value!;
        var created = await service.CreateSlotAsync(e.Id, occurrence.Id, owner,
            new(null, null, null, "programme.team", occurrence.StartUtc, occurrence.EndUtc, 1, "approvedGroupMember"), initial.ETag, default);
        Assert.True(created.IsSuccess, created.Message);
        Assert.Contains(await db.AuditLogs.Where(x => x.Action == EventArrangementConfirmationPolicy.ChangeAction).Select(x => x.AfterJson).ToListAsync(), json => json!.Contains("PROGRAM.PRODUCTION"));
        var group = await service.SaveRosterGroupAsync(e.Id, owner, new("programme.team", "PROGRAM.PRODUCTION", [owner]), "\"new\"", default);
        Assert.True(group.IsSuccess, group.Message);
        var moved = await service.SaveRosterGroupAsync(e.Id, owner, new("programme.team", "PLACE.RESOURCE", [owner]), group.Value!.ETag, default);
        Assert.True(moved.IsSuccess, moved.Message);
        var changes = await db.AuditLogs.Where(x => x.Action == EventArrangementConfirmationPolicy.ChangeAction).Select(x => x.AfterJson).ToListAsync();
        Assert.Contains(changes, json => json!.Contains("PROGRAM.PRODUCTION") && json.Contains("event.roster.groupMoved"));
        Assert.Contains(changes, json => json!.Contains("PLACE.RESOURCE") && json.Contains("event.roster.groupSaved"));
    }

    [Fact]
    public async Task RosterEndpoint_IsPrivateNoStoreAndReturnsItsConcurrencyETag()
    {
        var eventId = Guid.NewGuid(); var occurrenceId = Guid.NewGuid(); var memberId = Guid.NewGuid();
        var operations = Substitute.For<IEventOperationsService>();
        operations.GetRosterAsync(eventId, occurrenceId, memberId, Arg.Any<CancellationToken>())
            .Returns(AppResult<EventRosterDto>.Success(new(eventId, occurrenceId, "\"roster-token\"", [], [], false)));
        var accessor = Substitute.For<ICurrentMemberAccessor>(); accessor.GetCurrentMemberId().Returns(memberId);
        var controller = new EventOperationsController(operations, accessor) { ControllerContext = new() { HttpContext = new DefaultHttpContext() } };

        var response = await controller.GetRoster(eventId, occurrenceId, default);

        Assert.IsType<OkObjectResult>(response);
        Assert.Equal("no-store", controller.Response.Headers.CacheControl.ToString());
        Assert.Equal("\"roster-token\"", controller.Response.Headers.ETag.ToString());
    }

    [Fact]
    public async Task CandidateGroupApi_IsPrivateNoStore()
    {
        var operations = Substitute.For<IEventOperationsService>(); var current = Substitute.For<ICurrentMemberAccessor>();
        var eventId = Guid.NewGuid(); var memberId = Guid.NewGuid(); current.GetCurrentMemberId().Returns(memberId);
        operations.GetRosterGroupsAsync(eventId, memberId, Arg.Any<CancellationToken>())
            .Returns(AppResult<IReadOnlyList<EventRosterGroupDto>>.Success([]));
        var controller = new EventOperationsController(operations, current) { ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() } };
        Assert.IsType<OkObjectResult>(await controller.GetRosterGroups(eventId, default));
        Assert.Equal("private, no-store", controller.Response.Headers.CacheControl.ToString());
    }

    [Fact]
    public async Task TeamAndRoleInvitations_RequireTheInviteeAndNeverAutoAccept()
    {
        await using var db = CreateDb();
        var owner = Guid.NewGuid(); var invitee = Guid.NewGuid(); var stranger = Guid.NewGuid(); var groupId = Guid.NewGuid();
        var groupEvent = SeedEvent(db, groupId, owner);
        db.Members.AddRange(Member(owner, "Owner"), Member(invitee, "Invitee"), Member(stranger, "Stranger"));
        await db.SaveChangesAsync();
        var authorization = Authorization(owner);
        var service = new EventOperationsService(db, authorization);

        var invited = await service.InviteTeamMemberAsync(groupEvent.Id, owner, new(invitee), default);
        Assert.True(invited.IsSuccess);
        Assert.Equal(EventTeamMemberStatus.Invited, invited.Value!.Status);
        Assert.Null(invited.Value.JoinedUtc);

        var forbidden = await service.RespondToTeamInviteAsync(groupEvent.Id, invited.Value.Id, stranger, true, default);
        Assert.Equal(AppResultStatus.Forbidden, forbidden.Status);
        var accepted = await service.RespondToTeamInviteAsync(groupEvent.Id, invited.Value.Id, invitee, true, default);
        Assert.Equal(EventTeamMemberStatus.Accepted, accepted.Value!.Status);
        Assert.NotNull(accepted.Value.JoinedUtc);
    }

    [Fact]
    public async Task TaskUpdates_EnforceAssigneeBoundariesAndETag()
    {
        await using var db = CreateDb();
        var owner = Guid.NewGuid(); var assignee = Guid.NewGuid(); var groupId = Guid.NewGuid();
        var groupEvent = SeedEvent(db, groupId, owner);
        db.Members.AddRange(Member(owner, "Owner"), Member(assignee, "Assignee"));
        db.EventTeamMembers.Add(new EventTeamMember { Id = Guid.NewGuid(), EventId = groupEvent.Id, MemberId = assignee,
            InvitedByMemberId = owner, Status = EventTeamMemberStatus.Accepted, JoinedUtc = DateTime.UtcNow,
            CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow });
        await db.SaveChangesAsync();
        var service = new EventOperationsService(db, Authorization(owner));
        var created = await service.CreateTaskAsync(groupEvent.Id, owner,
            new(new("Prepare", "準備"), new("", ""), assignee, DateTime.UtcNow.AddHours(1), true), default);
        Assert.True(created.IsSuccess);

        var changedControlFields = await service.UpdateTaskAsync(groupEvent.Id, created.Value!.Id, assignee,
            new(created.Value.Title, created.Value.Description, owner, created.Value.DueUtc,
                EventTaskStatus.InProgress, false, false, false), created.Value.ETag, default);
        Assert.Equal(AppResultStatus.Forbidden, changedControlFields.Status);

        var changedDefinition = await service.UpdateTaskAsync(groupEvent.Id, created.Value.Id, assignee,
            new(new("Changed", "已更改"), created.Value.Description, assignee, created.Value.DueUtc,
                EventTaskStatus.InProgress, true, false, false), created.Value.ETag, default);
        Assert.Equal(AppResultStatus.Forbidden, changedDefinition.Status);
        var cancelledByAssignee = await service.UpdateTaskAsync(groupEvent.Id, created.Value.Id, assignee,
            new(created.Value.Title, created.Value.Description, assignee, created.Value.DueUtc,
                EventTaskStatus.Cancelled, true, false, false), created.Value.ETag, default);
        Assert.Equal(AppResultStatus.Forbidden, cancelledByAssignee.Status);

        var progressed = await service.UpdateTaskAsync(groupEvent.Id, created.Value.Id, assignee,
            new(created.Value.Title, created.Value.Description, assignee, created.Value.DueUtc,
                EventTaskStatus.InProgress, true, false, false), created.Value.ETag, default);
        Assert.Equal(EventTaskStatus.InProgress, progressed.Value!.Status);
        var stale = await service.UpdateTaskAsync(groupEvent.Id, created.Value.Id, assignee,
            new(progressed.Value.Title, progressed.Value.Description, assignee, progressed.Value.DueUtc,
                EventTaskStatus.Done, true, false, false), created.Value.ETag, default);
        Assert.Equal(AppResultStatus.PreconditionFailed, stale.Status);
    }

    [Fact]
    public async Task ProgrammeWrites_AreOccurrenceScopedAndRejectStaleETags()
    {
        await using var db = CreateDb();
        var owner = Guid.NewGuid(); var groupId = Guid.NewGuid();
        var groupEvent = SeedEvent(db, groupId, owner); db.Members.Add(Member(owner, "Owner"));
        var occurrence = SeedOccurrence(db, groupEvent);
        SeedPlan(db, groupEvent, Fact("programme.productionRequired", true));
        await db.SaveChangesAsync();
        var service = new EventOperationsService(db, Authorization(owner));
        var initial = await service.GetProgrammeAsync(groupEvent.Id, occurrence.Id, owner, default);
        Assert.True(initial.IsSuccess);
        db.ChangeTracker.Clear();
        var created = await service.CreateSessionAsync(groupEvent.Id, occurrence.Id, owner,
            new(new("Gathering", "聚會"), occurrence.StartUtc, occurrence.EndUtc, "{}", owner), initial.Value!.ETag, default);
        Assert.True(created.IsSuccess, created.Message);
        Assert.Single(created.Value!.Sessions);
        Assert.NotEqual(initial.Value.ETag, created.Value.ETag);
        var stale = await service.CreateSessionAsync(groupEvent.Id, occurrence.Id, owner,
            new(new("Stale", "過期"), occurrence.StartUtc, occurrence.EndUtc, "{}", owner), initial.Value.ETag, default);
        Assert.Equal(AppResultStatus.PreconditionFailed, stale.Status);
    }

    [Fact]
    public async Task Roster_RejectsUnavailableMemberAndExplainsConfirmedDemand()
    {
        await using var db = CreateDb();
        var owner = Guid.NewGuid(); var volunteer = Guid.NewGuid(); var groupId = Guid.NewGuid();
        var groupEvent = SeedEvent(db, groupId, owner); db.Members.AddRange(Member(owner, "Owner"), Member(volunteer, "Volunteer"));
        var occurrence = SeedOccurrence(db, groupEvent);
        SeedPlan(db, groupEvent, Fact("people.volunteersRequired", true));
        await db.SaveChangesAsync();
        var service = new EventOperationsService(db, Authorization(owner));
        var initial = await service.GetRosterAsync(groupEvent.Id, occurrence.Id, owner, default);
        db.ChangeTracker.Clear();
        var withSlot = await service.CreateSlotAsync(groupEvent.Id, occurrence.Id, owner,
            new(null, null, null, "welcome", occurrence.StartUtc, occurrence.EndUtc, 2, "approvedGroupMember"), initial.Value!.ETag, default);
        Assert.True(withSlot.IsSuccess, withSlot.Message);
        var slot = Assert.Single(withSlot.Value!.Slots);
        Assert.Contains(withSlot.Value.ReadinessBlockers, x => x.En.Contains("0/2", StringComparison.Ordinal));
        var stale = await service.CreateSlotAsync(groupEvent.Id, occurrence.Id, owner,
            new(null, null, null, "stale", occurrence.StartUtc, occurrence.EndUtc, 1, "approvedGroupMember"), initial.Value.ETag, default);
        Assert.Equal(AppResultStatus.PreconditionFailed, stale.Status);

        db.ChangeTracker.Clear();
        Assert.True((await service.SaveRosterGroupAsync(groupEvent.Id, owner,
            new(slot.RoleCode, "SERVICE.ROSTER", [volunteer]), "\"new\"", default)).IsSuccess);
        await service.SetAvailabilityAsync(groupEvent.Id, occurrence.Id, slot.Id, volunteer,
            new(EventAvailabilityStatus.Unavailable), default);
        db.ChangeTracker.Clear();
        var current = await service.GetRosterAsync(groupEvent.Id, occurrence.Id, owner, default);
        db.ChangeTracker.Clear();
        var rejected = await service.AssignRosterMemberAsync(groupEvent.Id, occurrence.Id, slot.Id, owner,
            new(volunteer), current.Value!.ETag, default);
        Assert.Equal(AppResultStatus.ValidationError, rejected.Status);
        Assert.Contains("unavailable", rejected.Message!, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task CandidateGroups_RejectOutsideMembers_KeepOrder_AndPreserveAssignmentHistory()
    {
        await using var db = CreateDb();
        var owner = Guid.NewGuid(); var a = Guid.NewGuid(); var b = Guid.NewGuid(); var outsider = Guid.NewGuid();
        var e = SeedEvent(db, Guid.NewGuid(), owner); var occurrence = SeedOccurrence(db, e);
        db.Members.AddRange(Member(owner, "Owner"), Member(a, "A"), Member(b, "B"), Member(outsider, "Other"));
        SeedPlan(db, e, Fact("people.volunteersRequired", true)); await db.SaveChangesAsync();
        var auth = Authorization(owner); var service = new EventOperationsService(db, auth);
        var initial = (await service.GetRosterAsync(e.Id, occurrence.Id, owner, default)).Value!;
        var roster = (await service.CreateSlotAsync(e.Id, occurrence.Id, owner,
            new(null, null, null, "welcome", occurrence.StartUtc, occurrence.EndUtc, 1, "approvedGroupMember"), initial.ETag, default)).Value!;
        var slot = Assert.Single(roster.Slots);
        Assert.Equal(AppResultStatus.ValidationError, (await service.AssignRosterMemberAsync(e.Id, occurrence.Id, slot.Id, owner, new(a), roster.ETag, default)).Status);
        var group = await service.SaveRosterGroupAsync(e.Id, owner, new("welcome", "SERVICE.ROSTER", [b, a]), "\"new\"", default);
        Assert.True(group.IsSuccess, group.Message); Assert.Equal(new[] { b, a }, group.Value!.MemberIds);
        var candidateView = await service.GetRosterAsync(e.Id, occurrence.Id, a, default);
        Assert.True(candidateView.IsSuccess, candidateView.Message);
        Assert.False(candidateView.Value!.CanManage);
        Assert.True(Assert.Single(candidateView.Value.Slots).IsRosterCandidate);
        Assert.All(candidateView.Value.Slots, x => { Assert.Empty(x.CandidateMemberIds!); Assert.Empty(x.Assignments); });
        Assert.Equal(AppResultStatus.Forbidden, (await service.GetRosterAsync(e.Id, occurrence.Id, outsider, default)).Status);
        var foreignMember = Guid.NewGuid();
        auth.IsApprovedMemberAsync(e.GroupId, foreignMember, Arg.Any<CancellationToken>()).Returns(false);
        Assert.Equal(AppResultStatus.ValidationError, (await service.SaveRosterGroupAsync(e.Id, owner, new("welcome", "SERVICE.ROSTER", [foreignMember]), group.Value.ETag, default)).Status);
        Assert.Equal(AppResultStatus.Forbidden, (await service.SaveRosterGroupAsync(e.Id, outsider, new("welcome", "SERVICE.ROSTER", [a]), group.Value.ETag, default)).Status);
        Assert.Equal(AppResultStatus.PreconditionFailed, (await service.SaveRosterGroupAsync(e.Id, owner, new("welcome", "SERVICE.ROSTER", [a]), "\"new\"", default)).Status);
        Assert.Equal(AppResultStatus.Forbidden, (await service.GetRosterGroupsAsync(e.Id, outsider, default)).Status);
        roster = (await service.GetRosterAsync(e.Id, occurrence.Id, owner, default)).Value!;
        Assert.Equal(AppResultStatus.ValidationError, (await service.AssignRosterMemberAsync(e.Id, occurrence.Id, slot.Id, owner, new(outsider), roster.ETag, default)).Status);
        var assigned = await service.AssignRosterMemberAsync(e.Id, occurrence.Id, slot.Id, owner, new(a), roster.ETag, default);
        Assert.True(assigned.IsSuccess, assigned.Message);
        var assignment = Assert.Single(Assert.Single(assigned.Value!.Slots).Assignments);
        Assert.Equal(AppResultStatus.Forbidden, (await service.RespondToRosterAssignmentAsync(e.Id, occurrence.Id, assignment.Id, owner, true, default)).Status);
        Assert.True((await service.RespondToRosterAssignmentAsync(e.Id, occurrence.Id, assignment.Id, a, true, default)).IsSuccess);
        roster = (await service.GetRosterAsync(e.Id, occurrence.Id, owner, default)).Value!;
        Assert.Equal(AppResultStatus.ValidationError, (await service.AssignRosterMemberAsync(e.Id, occurrence.Id, slot.Id, owner, new(outsider, assignment.Id), roster.ETag, default)).Status);
        Assert.True((await service.AssignRosterMemberAsync(e.Id, occurrence.Id, slot.Id, owner, new(b, assignment.Id), roster.ETag, default)).IsSuccess);
        Assert.Equal(2, await db.EventRosterAssignments.CountAsync());
        Assert.Equal(EventRosterAssignmentStatus.Ended, (await db.EventRosterAssignments.SingleAsync(x => x.Id == assignment.Id)).Status);
        var personal = (await service.GetRosterAsync(e.Id, occurrence.Id, b, default)).Value!;
        // Candidate lists are not exposed by a member-specific roster response.
        Assert.NotNull(personal); Assert.All(personal.Slots, x => Assert.Empty(x.CandidateMemberIds!));
    }

    [Fact]
    public async Task LeadersAndSpecialists_CannotEditAnotherOwnersPlan_OrTransferOwnership()
    {
        await using var db = CreateDb();
        var owner = Guid.NewGuid(); var other = Guid.NewGuid();
        var e = SeedEvent(db, Guid.NewGuid(), owner); SeedPlan(db, e, Fact("safety.requiresRam", true));
        db.Members.AddRange(Member(owner, "Owner"), Member(other, "Lead"));
        var roles = new[] { "TEAM.WORK:event.lead", "SAFETY.RAM:ram.author", "SAFETY.RAM:ram.approver" };
        var auth = Authorization(other); // The other actor is also a group leader.
        foreach (var role in roles)
        {
            db.EventRoleAssignments.RemoveRange(db.EventRoleAssignments);
            db.EventRoleAssignments.Add(new() { Id = Guid.NewGuid(), EventId = e.Id, MemberId = other,
                RoleRequirementKey = role, Status = EventRoleAssignmentStatus.Accepted, AssignedByMemberId = owner, CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow });
            await db.SaveChangesAsync();
            Assert.False(await EventCompositionPersistence.CanManageEventAsync(db, auth, e, other, default));
            Assert.Equal(role.EndsWith(":ram.author"), await EventCompositionPersistence.CanAuthorRamAsync(db, e, other, default));
        }
        var update = new Alife.Application.Events.Commands.UpdateGroupEvent.UpdateGroupEventCommandHandler(db, auth,
            Substitute.For<IEventCacheInvalidationService>(), new EventPackageInvalidationService(db));
        var result = await update.Handle(new(e.Id, other, "Changed", "修改", e.StartDate, e.EndDate, "{}"), default);
        Assert.Equal(AppResultStatus.Forbidden, result.Status); Assert.Equal("Event", e.TitleEn);
        var create = new Alife.Application.Events.Commands.CreateGroupEvent.CreateGroupEventCommandHandler(db, auth, Substitute.For<IEventCacheInvalidationService>());
        Assert.Equal(AppResultStatus.ValidationError, (await create.Handle(new(e.GroupId, other, "New", "新活动", e.StartDate, e.EndDate, "{}", AccountableOwnerMemberId: owner), default)).Status);
        var invite = new Alife.Application.Events.Composition.CreateEventRoleAssignmentCommandHandler(db, auth);
        Assert.Equal(AppResultStatus.ValidationError, (await invite.Handle(new(e.Id, owner, new("TEAM.WORK:event.accountableOwner", other), "no-transfer"), default)).Status);
        var pending = new EventRoleAssignment { Id = Guid.NewGuid(), EventId = e.Id, MemberId = other, RoleRequirementKey = "TEAM.WORK:event.accountableOwner",
            Status = EventRoleAssignmentStatus.Invited, AssignedByMemberId = owner, CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow };
        db.EventRoleAssignments.Add(pending); await db.SaveChangesAsync();
        var respond = new Alife.Application.Events.Composition.RespondToEventRoleAssignmentCommandHandler(db);
        Assert.Equal(AppResultStatus.Conflict, (await respond.Handle(new(e.Id, pending.Id, other, true), default)).Status);
        Assert.Equal(owner, e.AccountableOwnerMemberId);
    }

    [Fact]
    public async Task SeriesEdits_CannotBypassEventOwnership()
    {
        await using var db = CreateDb();
        var owner = Guid.NewGuid(); var leader = Guid.NewGuid();
        var e = SeedEvent(db, Guid.NewGuid(), owner); await db.SaveChangesAsync();
        var auth = Authorization(leader);
        var create = new Alife.Application.Events.Composition.CreateEventSeriesCommandHandler(db, auth);
        Assert.Equal(AppResultStatus.Forbidden, (await create.Handle(new(e.GroupId, leader,
            new(e.Id, new("Series", "系列"), "FREQ=WEEKLY", "UTC", new DateTime(2026, 10, 1, 10, 0, 0), 60), "foreign-series"), default)).Status);
        var series = new EventSeries { Id = Guid.NewGuid(), OwningGroupId = e.GroupId, CreatedByMemberId = leader,
            NameEn = "Series", NameZh = "系列", Events = [e], UpdatedUtc = DateTime.UtcNow };
        db.EventSeries.Add(series); await db.SaveChangesAsync();
        var update = new Alife.Application.Events.Composition.UpdateEventSeriesCommandHandler(db, auth);
        Assert.Equal(AppResultStatus.Forbidden, (await update.Handle(new(series.Id, leader,
            new(new("Changed", "修改"), "FREQ=WEEKLY", "UTC", new DateTime(2026, 10, 1, 10, 0, 0), 60), null), default)).Status);
        Assert.Equal("Series", series.NameEn);
    }

    private static AlifeDbContext CreateDb() => new(new DbContextOptionsBuilder<AlifeDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
    private static Member Member(Guid id, string name) => new() { Id = id, DisplayName = name, IsRegistered = true,
        CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow };
    private static GroupEvent SeedEvent(AlifeDbContext db, Guid groupId, Guid owner) {
        var value = new GroupEvent { Id = Guid.NewGuid(), GroupId = groupId, CreatedByMemberId = owner,
            AccountableOwnerMemberId = owner, TitleEn = "Event", TitleZh = "活動", StartDate = DateTime.UtcNow.AddDays(1),
            EndDate = DateTime.UtcNow.AddDays(1).AddHours(2), CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow };
        db.GroupEvents.Add(value); return value;
    }
    private static EventOccurrence SeedOccurrence(AlifeDbContext db, GroupEvent groupEvent) {
        var value = new EventOccurrence { Id = Guid.NewGuid(), EventId = groupEvent.Id, StartUtc = groupEvent.StartDate,
            EndUtc = groupEvent.EndDate, LocalDate = DateOnly.FromDateTime(groupEvent.StartDate), CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow }; db.EventOccurrences.Add(value); return value;
    }
    private static void SeedPlan(AlifeDbContext db, GroupEvent groupEvent, params EventFactInputDto[] facts) {
        var allFacts = facts;
        var plan = new EventCompositionEngine().Compose(new(EventCompositionDefinitions.LegacySchemaVersion, null,
            new(allFacts), []), new EventCompositionContext("\"baseline\"", HasAccountableOwner: true)).Value!;
        groupEvent.ActivePlanVersion = 1;
        db.EventPlanSnapshots.Add(new EventPlanSnapshot { Id = Guid.NewGuid(), EventId = groupEvent.Id, Version = 1,
            SourceFactSetId = Guid.NewGuid(), SchemaVersion = plan.SchemaVersion, ProposalHash = plan.ProposalHash,
            ETag = EventCompositionPersistence.CreatePlanETag(1, plan.ProposalHash), SnapshotJson = EventCompositionPersistence.SerializePlan(plan, []),
            IsActive = true, AcceptedByMemberId = groupEvent.AccountableOwnerMemberId, AcceptedUtc = DateTime.UtcNow,
            CreatedUtc = DateTime.UtcNow });
    }
    private static EventFactInputDto Fact(string code, object value) => new(code, JsonSerializer.SerializeToElement(value), EventFactCertainty.Confirmed, EventFactSource.Human);
    private static IGroupAuthorizationService Authorization(Guid owner) {
        var result = Substitute.For<IGroupAuthorizationService>();
        result.IsApprovedMemberAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(true);
        result.IsLeaderOrCoLeaderAsync(Arg.Any<Guid>(), owner, Arg.Any<CancellationToken>()).Returns(true);
        return result;
    }
}
