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

public sealed class EventOperationsCoreTests
{
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
