using Alife.Api.Controllers;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Groups.Commands.DissolveGroup;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using MediatR;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.Groups;

public class GroupDissolutionTests
{
    private readonly Guid groupId = Guid.NewGuid();
    private readonly Guid leaderId = Guid.NewGuid();
    private readonly Guid parentId = Guid.NewGuid();
    private readonly IGroupCacheInvalidationService cache = Substitute.For<IGroupCacheInvalidationService>();
    private readonly ICloudflareKvCacheService kv = Substitute.For<ICloudflareKvCacheService>();

    private async Task<AlifeDbContext> CreateDb()
    {
        var db = new AlifeDbContext(new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        db.Groups.Add(new Group { Id = parentId, IsChurch = true });
        db.Groups.Add(new Group { Id = groupId, ParentGroupId = parentId, NameJson = "{\"en\":\"Empty group\",\"zh\":\"空小组\"}" });
        db.Members.Add(new Member { Id = leaderId, IsRegistered = true });
        db.GroupMemberships.Add(new GroupMembership { Id = Guid.NewGuid(), GroupId = groupId, MemberId = leaderId,
            Role = MembershipRole.Leader, Status = MembershipStatus.Approved });
        await db.SaveChangesAsync();
        return db;
    }
    private Task<AppResult<Alife.Application.Groups.Dtos.GroupActionResultDto>> Dissolve(AlifeDbContext db, Guid? actor = null)
        => new DissolveGroupCommandHandler(db, cache, kv).Handle(new(groupId, actor ?? leaderId), default);

    [Theory]
    [InlineData(GroupType.Fellowship, false)]
    [InlineData(GroupType.Ministry, false)]
    [InlineData(GroupType.Fellowship, true)]
    public async Task SoleLeaderCanDissolveEmptyGroupAndPreserveAccount(GroupType type, bool closed)
    {
        await using var db = await CreateDb();
        var group = await db.Groups.SingleAsync(x => x.Id == groupId);
        group.GroupType = type; group.IsClosed = closed;
        db.GroupMemberships.Add(new GroupMembership { Id = Guid.NewGuid(), GroupId = parentId, MemberId = leaderId });
        await db.SaveChangesAsync();
        Assert.True((await Dissolve(db)).IsSuccess);
        Assert.False(await db.Groups.AnyAsync(x => x.Id == groupId));
        Assert.False(await db.GroupMemberships.AnyAsync(x => x.GroupId == groupId));
        Assert.True(await db.Members.AnyAsync(x => x.Id == leaderId));
        Assert.True(await db.GroupMemberships.AnyAsync(x => x.GroupId == parentId));
        var audit = await db.AuditLogs.SingleAsync();
        Assert.Equal("group.dissolved", audit.Action);
        Assert.Equal(groupId, audit.EntityId);
        Assert.Equal(leaderId, audit.ActorMemberId);
        Assert.Null(audit.GroupId);
        await cache.Received().RemoveGroupAsync(groupId, Arg.Any<CancellationToken>());
        await cache.Received().RemoveSubgroupsAsync(parentId, Arg.Any<CancellationToken>());
        await cache.Received().RemoveMembershipsAsync(groupId, Arg.Any<CancellationToken>());
        await kv.Received().RemoveMembershipAsync(groupId, leaderId, Arg.Any<CancellationToken>());
        await kv.Received().RemoveApiCacheKeyAsync($"member:{leaderId}:me", Arg.Any<CancellationToken>());
        await kv.Received().RemoveMemberProfileAsync(leaderId, Arg.Any<CancellationToken>());
        Assert.False((await Dissolve(db)).IsSuccess);
        Assert.Single(await db.AuditLogs.ToListAsync());
    }

    [Theory]
    [InlineData(MembershipRole.CoLeader, MembershipStatus.Approved)]
    [InlineData(MembershipRole.Member, MembershipStatus.Approved)]
    [InlineData(MembershipRole.Leader, MembershipStatus.Requested)]
    [InlineData(MembershipRole.Leader, MembershipStatus.Removed)]
    public async Task OnlyApprovedActualLeaderCanDissolve(MembershipRole role, MembershipStatus status)
    {
        await using var db = await CreateDb();
        var membership = await db.GroupMemberships.SingleAsync();
        membership.Role = role; membership.Status = status;
        await db.SaveChangesAsync();
        Assert.Equal(AppResultStatus.Forbidden, (await Dissolve(db)).Status);
        Assert.Equal(2, await db.Groups.CountAsync());
        Assert.Empty(await db.AuditLogs.ToListAsync());
    }

    [Fact]
    public async Task AdministratorWithoutLeadershipCannotDissolve()
    {
        await using var db = await CreateDb();
        var admin = new Member { Id = Guid.NewGuid(), IsRegistered = true };
        db.Members.Add(admin);
        db.MemberPlatformRoles.Add(new MemberPlatformRole { Id = Guid.NewGuid(), MemberId = admin.Id, RoleId = (int)PlatformRoleId.SuperAdmin });
        await db.SaveChangesAsync();
        Assert.Equal(AppResultStatus.Forbidden, (await Dissolve(db, admin.Id)).Status);
    }

    [Theory]
    [InlineData(MembershipStatus.Approved)]
    [InlineData(MembershipStatus.Invited)]
    [InlineData(MembershipStatus.Requested)]
    [InlineData(MembershipStatus.Rejected)]
    [InlineData(MembershipStatus.Removed)]
    public async Task AdditionalMembershipInAnyStateBlocksDissolution(MembershipStatus status)
    {
        await using var db = await CreateDb();
        db.GroupMemberships.Add(new GroupMembership { Id = Guid.NewGuid(), GroupId = groupId, MemberId = Guid.NewGuid(), Status = status });
        await db.SaveChangesAsync();
        var check = await new GetGroupDissolutionQueryHandler(db).Handle(new(groupId, leaderId), default);
        Assert.Contains("members", check.Value!.Blockers);
        Assert.Equal(AppResultStatus.Conflict, (await Dissolve(db)).Status);
    }

    [Theory]
    [InlineData("church")]
    [InlineData("subgroups")]
    [InlineData("pages")]
    [InlineData("events")]
    [InlineData("series")]
    [InlineData("albums")]
    [InlineData("announcements")]
    [InlineData("contacts")]
    [InlineData("forum")]
    [InlineData("invites")]
    [InlineData("files")]
    [InlineData("audit")]
    public async Task ContentAddedAfterPreviewIsNotDeleted(string kind)
    {
        await using var db = await CreateDb();
        Assert.True((await new GetGroupDissolutionQueryHandler(db).Handle(new(groupId, leaderId), default)).Value!.CanDissolve);
        switch (kind)
        {
            case "church": (await db.Groups.SingleAsync(x => x.Id == groupId)).IsChurch = true; break;
            case "subgroups": db.Groups.Add(new Group { Id = Guid.NewGuid(), ParentGroupId = groupId, IsClosed = true }); break;
            case "pages": db.Pages.Add(new Page { Id = Guid.NewGuid(), OwnerGroupId = groupId }); break;
            case "events": db.GroupEvents.Add(new GroupEvent { Id = Guid.NewGuid(), GroupId = groupId }); break;
            case "series": db.EventSeries.Add(new EventSeries { Id = Guid.NewGuid(), OwningGroupId = groupId }); break;
            case "albums": db.Albums.Add(new Album { Id = Guid.NewGuid(), GroupId = groupId }); break;
            case "announcements": db.Announcements.Add(new Announcement { Id = Guid.NewGuid(), GroupId = groupId }); break;
            case "contacts": db.ContactProfiles.Add(new ContactProfile { Id = Guid.NewGuid(), OwnerGroupId = groupId }); break;
            case "forum": db.ForumPosts.Add(new ForumPost { Id = Guid.NewGuid(), GroupId = groupId }); break;
            case "invites": db.GroupJoinInvites.Add(new GroupJoinInvite { Id = Guid.NewGuid(), GroupId = groupId }); break;
            case "files": db.FileAssets.Add(new FileAsset { Id = Guid.NewGuid(), GroupId = groupId }); break;
            case "audit": db.AuditLogs.Add(new AuditLog { Id = Guid.NewGuid(), GroupId = groupId }); break;
        }
        await db.SaveChangesAsync();
        var count = db.ChangeTracker.Entries().Count();
        Assert.Equal(AppResultStatus.Conflict, (await Dissolve(db)).Status);
        Assert.Equal(count, db.ChangeTracker.Entries().Count());
        Assert.True(await db.Groups.AnyAsync(x => x.Id == groupId));
        await kv.DidNotReceive().RemoveMembershipAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task UnauthenticatedControllerCallsAreDeniedAndNotCached()
    {
        var mediator = Substitute.For<IMediator>();
        var accessor = Substitute.For<ICurrentMemberAccessor>();
        accessor.GetCurrentMemberId().Returns((Guid?)null);
        var controller = new GroupsController(mediator, accessor) { ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() } };
        Assert.IsType<UnauthorizedResult>(await controller.GetDissolution(groupId, default));
        Assert.IsType<UnauthorizedResult>(await controller.Dissolve(groupId, default));
        Assert.Contains("no-store", controller.Response.Headers.CacheControl.ToString());
        Assert.Empty(mediator.ReceivedCalls());
    }
}
