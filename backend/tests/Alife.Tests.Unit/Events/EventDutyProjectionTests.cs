using Alife.Api.Controllers;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Admin;
using Alife.Application.Common.Models;
using Alife.Application.Events.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.Events;

public sealed class EventDutyProjectionTests
{
    private static AlifeDbContext Db() => new(new DbContextOptionsBuilder<AlifeDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
    private static EventDutyProjectionService Projection(AlifeDbContext db)
    {
        var packages = Substitute.For<IEventPackageService>();
        packages.ListDutiesAsync(Arg.Any<Guid>(), Arg.Any<IReadOnlyList<GroupEvent>>(), Arg.Any<CancellationToken>()).Returns(Array.Empty<EventDuty>());
        return new(db, packages);
    }
    private static GroupEvent Seed(AlifeDbContext db, Guid member)
    {
        var e = new GroupEvent { Id = Guid.NewGuid(), GroupId = Guid.NewGuid(), AccountableOwnerMemberId = Guid.NewGuid(), TitleEn = "Community gathering", TitleZh = "社区聚会", StartDate = DateTime.UtcNow.AddDays(1), EndDate = DateTime.UtcNow.AddDays(2) };
        db.Groups.Add(new() { Id = e.GroupId, IsChurch = true }); db.GroupEvents.Add(e);
        db.Members.Add(new() { Id = member });
        db.GroupMemberships.Add(new() { Id = Guid.NewGuid(), GroupId = e.GroupId, MemberId = member, Status = MembershipStatus.Approved });
        return e;
    }

    [Fact]
    public async Task InvitationsAndSubstitution_AreDiscoveredFromBusinessState_AndDisappearOnEndOrDeparture()
    {
        await using var db = Db(); var member = Guid.NewGuid(); var e = Seed(db, member);
        var team = new EventTeamMember { Id = Guid.NewGuid(), EventId = e.Id, MemberId = member, Status = EventTeamMemberStatus.Invited };
        var role = new EventRoleAssignment { Id = Guid.NewGuid(), EventId = e.Id, MemberId = member, RoleRequirementKey = "TEAM.WORK:event.lead", Status = EventRoleAssignmentStatus.Invited };
        var occurrence = new EventOccurrence { Id = Guid.NewGuid(), EventId = e.Id, StartUtc = e.StartDate, EndUtc = e.EndDate };
        var slot = new EventServiceSlot { Id = Guid.NewGuid(), OccurrenceId = occurrence.Id, RoleCode = "welcome", EligibilityCode = "approvedGroupMember", StartUtc = e.StartDate, EndUtc = e.EndDate, RequiredCount = 1 };
        var assignment = new EventRosterAssignment { Id = Guid.NewGuid(), ServiceSlotId = slot.Id, MemberId = member, Status = EventRosterAssignmentStatus.Invited };
        db.EventTeamMembers.Add(team); db.EventRoleAssignments.Add(role); db.EventOccurrences.Add(occurrence); db.EventServiceSlots.Add(slot); db.EventRosterAssignments.Add(assignment); await db.SaveChangesAsync();
        var projection = Projection(db); var initial = await projection.ListAsync(member, default);
        Assert.Equal(3, initial.Count); Assert.Equal(3, initial.Select(x => x.Task.TaskKey).Distinct().Count());
        Assert.All(initial, d => Assert.Equal("workflow", d.Task.CompletionMode));
        Assert.Empty(await projection.ListAsync(Guid.NewGuid(), default));
        Assert.All(db.ChangeTracker.Entries(), entry => Assert.Equal(EntityState.Unchanged, entry.State));
        team.Status = EventTeamMemberStatus.Accepted; role.Status = EventRoleAssignmentStatus.Declined; role.EndedUtc = DateTime.UtcNow;
        assignment.Status = EventRosterAssignmentStatus.Ended; assignment.EndedUtc = DateTime.UtcNow; await db.SaveChangesAsync();
        Assert.Empty(await projection.ListAsync(member, default));
        db.EventRosterAssignments.Add(new() { Id = Guid.NewGuid(), ServiceSlotId = slot.Id, MemberId = member, Status = EventRosterAssignmentStatus.Invited, ReplacesAssignmentId = assignment.Id }); await db.SaveChangesAsync();
        Assert.Single(await projection.ListAsync(member, default));
        occurrence.Status = EventOccurrenceStatus.Cancelled; team.Status = EventTeamMemberStatus.Invited;
        await db.SaveChangesAsync(); Assert.Empty(await projection.ListAsync(member, default));
        occurrence.Status = EventOccurrenceStatus.Scheduled; db.GroupMemberships.Single().Status = MembershipStatus.Removed; await db.SaveChangesAsync();
        Assert.Empty(await projection.ListAsync(member, default));
    }

    [Fact]
    public async Task RamReview_LaterQualifiedReviewerFindsCurrentVersion_WithoutNotification_AndIsolatedSummary()
    {
        await using var db = Db(); var reviewer = Guid.NewGuid(); var e = Seed(db, reviewer); var author = e.AccountableOwnerMemberId;
        var revision = new EventRamRevision { Id = Guid.NewGuid(), EventId = e.Id, Version = 1, AuthorMemberId = author, RamDataJson = "{\"hazards\":\"PRIVATE_HAZARD\"}" };
        var ram = new EventRamAssessment { EventId = e.Id, SchemaVersion = 2, CurrentRevisionId = revision.Id, AuthorMemberId = author, SubmittedByMemberId = author, Validity = "AwaitingReview", Status = EventRamStatus.AwaitingReview, RamDataJson = revision.RamDataJson };
        db.EventRamRevisions.Add(revision); db.EventRamAssessments.Add(ram); await db.SaveChangesAsync(); var projection = Projection(db);
        Assert.Empty(await projection.ListAsync(reviewer, default));
        db.PlatformRoles.Add(new() { Id = 922, Code = "safety-reviewer", PermissionsJson = AdminPermissionCatalog.WritePermissions([AdminPermissionCatalog.AuditEvents]) });
        var grant = new MemberPlatformRole { Id = Guid.NewGuid(), MemberId = reviewer, RoleId = 922 }; db.MemberPlatformRoles.Add(grant); await db.SaveChangesAsync();
        var duty = Assert.Single(await projection.ListAsync(reviewer, default));
        Assert.DoesNotContain("PRIVATE_HAZARD", duty.Task.ActionDataJson); Assert.DoesNotContain("hazards", duty.Task.ActionDataJson);
        Assert.Equal(revision.Id, duty.Task.SourceId);
        Assert.Equal(AppResultStatus.Conflict, (await projection.GetAsync(Guid.NewGuid(), "ramRevision", revision.Id, reviewer, duty.Task.TaskKey, default)).Status);
        revision.OnsiteMemberId = reviewer; await db.SaveChangesAsync(); Assert.Empty(await projection.ListAsync(reviewer, default));
        revision.OnsiteMemberId = null; grant.RevokedUtc = DateTime.UtcNow; await db.SaveChangesAsync(); Assert.Empty(await projection.ListAsync(reviewer, default));
        grant.RevokedUtc = null; ram.CurrentRevisionId = null; await db.SaveChangesAsync();
        Assert.Equal(AppResultStatus.Conflict, (await projection.GetAsync(e.Id, "ramRevision", revision.Id, reviewer, duty.Task.TaskKey, default)).Status);
        Assert.Empty(await db.NotificationMessages.ToListAsync());
    }

    [Fact]
    public async Task DutyEndpoint_AppliesPrivateNoStoreToSuccessAndStaleVersion()
    {
        await using var db = Db(); var member = Guid.NewGuid(); var e = Seed(db, member);
        var team = new EventTeamMember { Id = Guid.NewGuid(), EventId = e.Id, MemberId = member, Status = EventTeamMemberStatus.Invited }; db.EventTeamMembers.Add(team); await db.SaveChangesAsync();
        var projection = Projection(db); var duty = Assert.Single(await projection.ListAsync(member, default));
        var current = Substitute.For<ICurrentMemberAccessor>(); current.GetCurrentMemberId().Returns(member);
        var controller = new EventDutiesController(projection, current) { ControllerContext = new() { HttpContext = new DefaultHttpContext() } };
        Assert.IsType<OkObjectResult>(await controller.Get(e.Id, "teamInvitation", team.Id, duty.Task.TaskKey, default));
        Assert.Equal("private, no-store", controller.Response.Headers.CacheControl.ToString());
        var stale = await controller.Get(e.Id, "teamInvitation", team.Id, "old-version", default);
        Assert.Equal(409, Assert.IsAssignableFrom<ObjectResult>(stale).StatusCode);
        Assert.Equal("private, no-store", controller.Response.Headers.CacheControl.ToString());
    }
}
