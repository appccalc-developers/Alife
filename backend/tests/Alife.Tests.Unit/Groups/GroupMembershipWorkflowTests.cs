using Alife.Application.Common.Interfaces;
using Alife.Application.Groups.Commands.ApproveGroupMember;
using Alife.Application.Groups.Commands.ClaimSubgroupCoLeader;
using Alife.Application.Groups.Commands.CloseGroup;
using Alife.Application.Groups.Commands.CreateSubgroup;
using Alife.Application.Groups.Commands.InviteGroupMemberById;
using Alife.Application.Groups.Commands.JoinGroup;
using Alife.Application.Groups.Commands.KickGroupMember;
using Alife.Application.Groups.Commands.SetGroupCoLeader;
using Alife.Application.Groups.Commands.SetSubgroupLeader;
using Alife.Application.Groups.Queries.GetGroupInviteCandidates;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.Groups;

public class GroupMembershipWorkflowTests
{
    [Fact]
    public async Task JoinGroup_RequiresParentMembershipForSubgroup()
    {
        using var dbContext = CreateInMemoryDbContext();
        var parentId = Guid.NewGuid();
        var childId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        dbContext.Groups.AddRange(
            CreateGroup(parentId, AccessType.Protected),
            CreateGroup(childId, AccessType.Protected, parentId));
        await dbContext.SaveChangesAsync();

        var authorizationService = Substitute.For<IGroupAuthorizationService>();
        authorizationService.IsRegisteredMemberAsync(memberId, Arg.Any<CancellationToken>()).Returns(true);
        authorizationService.IsApprovedMemberAsync(parentId, memberId, Arg.Any<CancellationToken>()).Returns(false);
        var handler = new JoinGroupCommandHandler(
            dbContext,
            authorizationService,
            Substitute.For<IGroupCacheInvalidationService>(),
            Substitute.For<ICloudflareKvCacheService>());

        var result = await handler.Handle(new JoinGroupCommand(childId, memberId), CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Empty(dbContext.GroupMemberships);
    }

    [Fact]
    public async Task JoinGroup_PrivateSubgroupCreatesRejectedMembershipForParentMember()
    {
        using var dbContext = CreateInMemoryDbContext();
        var parentId = Guid.NewGuid();
        var childId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        dbContext.Groups.AddRange(
            CreateGroup(parentId, AccessType.Protected),
            CreateGroup(childId, AccessType.Private, parentId));
        await dbContext.SaveChangesAsync();

        var authorizationService = Substitute.For<IGroupAuthorizationService>();
        authorizationService.IsRegisteredMemberAsync(memberId, Arg.Any<CancellationToken>()).Returns(true);
        authorizationService.IsApprovedMemberAsync(parentId, memberId, Arg.Any<CancellationToken>()).Returns(true);
        var handler = new JoinGroupCommandHandler(
            dbContext,
            authorizationService,
            Substitute.For<IGroupCacheInvalidationService>(),
            Substitute.For<ICloudflareKvCacheService>());

        var result = await handler.Handle(new JoinGroupCommand(childId, memberId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal("rejected", result.Value!.Status);
        Assert.Equal(MembershipStatus.Rejected, dbContext.GroupMemberships.Single().Status);
    }

    [Fact]
    public async Task JoinGroup_ProtectedGroupNotifiesGroupLeadersOfRequest()
    {
        using var dbContext = CreateInMemoryDbContext();
        var groupId = Guid.NewGuid();
        var leaderId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        dbContext.Groups.Add(CreateGroup(groupId, AccessType.Protected));
        dbContext.Members.AddRange(CreateMember(leaderId, "Leader"), CreateMember(memberId, "Applicant"));
        dbContext.GroupMemberships.Add(CreateMembership(groupId, leaderId, MembershipStatus.Approved, DateTime.UtcNow, MembershipRole.CoLeader));
        await dbContext.SaveChangesAsync();

        var authorizationService = Substitute.For<IGroupAuthorizationService>();
        authorizationService.IsRegisteredMemberAsync(memberId, Arg.Any<CancellationToken>()).Returns(true);
        var handler = new JoinGroupCommandHandler(
            dbContext,
            authorizationService,
            Substitute.For<IGroupCacheInvalidationService>(),
            Substitute.For<ICloudflareKvCacheService>());

        var result = await handler.Handle(new JoinGroupCommand(groupId, memberId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var notification = await dbContext.NotificationMessages.SingleAsync();
        Assert.Equal(leaderId, notification.RecipientMemberId);
        Assert.Equal(memberId, notification.CreatedByMemberId);
        Assert.Equal(groupId, notification.GroupId);
        Assert.Equal("group.join-request.received", notification.ActionType);
        Assert.Contains($"/groups/{groupId}/manage", notification.ActionDataJson);
    }

    [Fact]
    public async Task ApproveGroupMember_CreatesChurchMembershipForRegisteredLineCandidate()
    {
        using var dbContext = CreateInMemoryDbContext();
        var churchId = Guid.NewGuid();
        var leaderId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        dbContext.Groups.Add(CreateGroup(churchId, AccessType.Protected, isChurch: true));
        dbContext.Members.Add(new Member
        {
            Id = memberId,
            DisplayName = "Line Member",
            LineUID = "line-1",
            IsRegistered = true,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        });
        await dbContext.SaveChangesAsync();

        var authorizationService = Substitute.For<IGroupAuthorizationService>();
        authorizationService.IsLeaderOrCoLeaderAsync(churchId, leaderId, Arg.Any<CancellationToken>()).Returns(true);
        var handler = new ApproveGroupMemberCommandHandler(
            dbContext,
            authorizationService,
            Substitute.For<IGroupCacheInvalidationService>(),
            Substitute.For<ICloudflareKvCacheService>());

        var result = await handler.Handle(new ApproveGroupMemberCommand(churchId, leaderId, memberId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var membership = dbContext.GroupMemberships.Single();
        Assert.Equal(churchId, membership.GroupId);
        Assert.Equal(memberId, membership.MemberId);
        Assert.Equal(MembershipStatus.Approved, membership.Status);
    }

    [Fact]
    public async Task CreateSubgroup_SetsCreatorAsApprovedLeader()
    {
        using var dbContext = CreateInMemoryDbContext();
        var parentId = Guid.NewGuid();
        var leaderId = Guid.NewGuid();
        dbContext.Groups.Add(CreateGroup(parentId, AccessType.Protected));
        await dbContext.SaveChangesAsync();

        var authorizationService = Substitute.For<IGroupAuthorizationService>();
        authorizationService.IsLeaderOrCoLeaderAsync(parentId, leaderId, Arg.Any<CancellationToken>()).Returns(true);
        var invalidationService = Substitute.For<IGroupCacheInvalidationService>();
        var cloudflareKvCacheService = Substitute.For<ICloudflareKvCacheService>();
        var handler = new CreateSubgroupCommandHandler(
            dbContext,
            authorizationService,
            invalidationService,
            cloudflareKvCacheService);

        var result = await handler.Handle(
            new CreateSubgroupCommand(
                parentId,
                leaderId,
                new Dictionary<string, string> { ["en"] = "New subgroup", ["zh"] = "新子小组" },
                null,
                AccessType.Protected),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        var membership = dbContext.GroupMemberships.Single();
        Assert.Equal(result.Value!.Id, membership.GroupId);
        Assert.Equal(leaderId, membership.MemberId);
        Assert.Equal(MembershipStatus.Approved, membership.Status);
        Assert.Equal(MembershipRole.Leader, membership.Role);
        await invalidationService.Received(1).RemoveSubgroupsAsync(parentId, Arg.Any<CancellationToken>());
        await invalidationService.Received(1).RemoveMembershipsAsync(result.Value!.Id, Arg.Any<CancellationToken>());
        await cloudflareKvCacheService.Received(1).PutApprovedMembershipAsync(
            result.Value!.Id,
            leaderId,
            MembershipRole.Leader,
            Arg.Any<DateTime>(),
            Arg.Any<CancellationToken>());
        await cloudflareKvCacheService.Received(1).RemoveApiCacheKeyAsync(
            $"member:{leaderId}:me",
            Arg.Any<CancellationToken>());
        await cloudflareKvCacheService.Received(1).RemoveMemberProfileAsync(leaderId, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task CloseGroup_ReturnsParentGroupIdAndInvalidatesParentSubgroups()
    {
        using var dbContext = CreateInMemoryDbContext();
        var parentId = Guid.NewGuid();
        var childId = Guid.NewGuid();
        var leaderId = Guid.NewGuid();
        dbContext.Groups.AddRange(
            CreateGroup(parentId, AccessType.Protected),
            CreateGroup(childId, AccessType.Protected, parentId));
        await dbContext.SaveChangesAsync();

        var authorizationService = Substitute.For<IGroupAuthorizationService>();
        authorizationService.IsLeaderOrCoLeaderAsync(childId, leaderId, Arg.Any<CancellationToken>()).Returns(true);
        var invalidationService = Substitute.For<IGroupCacheInvalidationService>();
        var handler = new CloseGroupCommandHandler(
            dbContext,
            authorizationService,
            invalidationService);

        var result = await handler.Handle(new CloseGroupCommand(childId, leaderId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(childId, result.Value!.GroupId);
        Assert.Equal(parentId, result.Value.ParentGroupId);
        Assert.True(await dbContext.Groups.Where(x => x.Id == childId).Select(x => x.IsClosed).SingleAsync());
        await invalidationService.Received(1).RemoveGroupAsync(childId, Arg.Any<CancellationToken>());
        await invalidationService.Received(1).RemoveSubgroupsAsync(parentId, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ClaimSubgroupCoLeader_ParentManagerBecomesApprovedCoLeader()
    {
        using var dbContext = CreateInMemoryDbContext();
        var parentId = Guid.NewGuid();
        var childId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        dbContext.Groups.AddRange(
            CreateGroup(parentId, AccessType.Protected),
            CreateGroup(childId, AccessType.Protected, parentId));
        await dbContext.SaveChangesAsync();

        var authorizationService = Substitute.For<IGroupAuthorizationService>();
        authorizationService.IsLeaderOrCoLeaderAsync(parentId, memberId, Arg.Any<CancellationToken>()).Returns(true);
        var invalidationService = Substitute.For<IGroupCacheInvalidationService>();
        var cloudflareKvCacheService = Substitute.For<ICloudflareKvCacheService>();
        var handler = new ClaimSubgroupCoLeaderCommandHandler(
            dbContext,
            authorizationService,
            invalidationService,
            cloudflareKvCacheService);

        var result = await handler.Handle(new ClaimSubgroupCoLeaderCommand(parentId, childId, memberId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var membership = dbContext.GroupMemberships.Single();
        Assert.Equal(childId, membership.GroupId);
        Assert.Equal(memberId, membership.MemberId);
        Assert.Equal(MembershipStatus.Approved, membership.Status);
        Assert.Equal(MembershipRole.CoLeader, membership.Role);
        await cloudflareKvCacheService.Received(1).PutApprovedMembershipAsync(
            childId,
            memberId,
            MembershipRole.CoLeader,
            Arg.Any<DateTime>(),
            Arg.Any<CancellationToken>());
        await cloudflareKvCacheService.Received(1).RemoveApiCacheKeyAsync(
            $"member:{memberId}:me",
            Arg.Any<CancellationToken>());
        await cloudflareKvCacheService.Received(1).RemoveMemberProfileAsync(memberId, Arg.Any<CancellationToken>());
        await invalidationService.Received(1).RemoveMembershipsAsync(childId, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ClaimSubgroupCoLeader_RequiresParentManager()
    {
        using var dbContext = CreateInMemoryDbContext();
        var parentId = Guid.NewGuid();
        var childId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        dbContext.Groups.AddRange(
            CreateGroup(parentId, AccessType.Protected),
            CreateGroup(childId, AccessType.Protected, parentId));
        await dbContext.SaveChangesAsync();

        var authorizationService = Substitute.For<IGroupAuthorizationService>();
        authorizationService.IsLeaderOrCoLeaderAsync(parentId, memberId, Arg.Any<CancellationToken>()).Returns(false);
        var invalidationService = Substitute.For<IGroupCacheInvalidationService>();
        var cloudflareKvCacheService = Substitute.For<ICloudflareKvCacheService>();
        var handler = new ClaimSubgroupCoLeaderCommandHandler(
            dbContext,
            authorizationService,
            invalidationService,
            cloudflareKvCacheService);

        var result = await handler.Handle(new ClaimSubgroupCoLeaderCommand(parentId, childId, memberId), CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Empty(dbContext.GroupMemberships);
        await cloudflareKvCacheService.DidNotReceiveWithAnyArgs().PutApprovedMembershipAsync(
            default,
            default,
            default,
            default,
            default);
        await invalidationService.DidNotReceiveWithAnyArgs().RemoveMembershipsAsync(default, default);
    }

    [Fact]
    public async Task SetSubgroupLeader_ParentManagerAssignsApprovedParentMemberAsOnlyLeader()
    {
        using var dbContext = CreateInMemoryDbContext();
        var parentId = Guid.NewGuid();
        var childId = Guid.NewGuid();
        var parentManagerId = Guid.NewGuid();
        var oldLeaderId = Guid.NewGuid();
        var newLeaderId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        dbContext.Groups.AddRange(
            CreateGroup(parentId, AccessType.Protected),
            CreateGroup(childId, AccessType.Protected, parentId));
        dbContext.GroupMemberships.AddRange(
            CreateMembership(parentId, newLeaderId, MembershipStatus.Approved, now),
            CreateMembership(childId, oldLeaderId, MembershipStatus.Approved, now, MembershipRole.Leader));
        await dbContext.SaveChangesAsync();

        var authorizationService = Substitute.For<IGroupAuthorizationService>();
        authorizationService.IsLeaderOrCoLeaderAsync(parentId, parentManagerId, Arg.Any<CancellationToken>()).Returns(true);
        var invalidationService = Substitute.For<IGroupCacheInvalidationService>();
        var cloudflareKvCacheService = Substitute.For<ICloudflareKvCacheService>();
        var handler = new SetSubgroupLeaderCommandHandler(
            dbContext,
            authorizationService,
            invalidationService,
            cloudflareKvCacheService);

        var result = await handler.Handle(
            new SetSubgroupLeaderCommand(parentId, childId, parentManagerId, newLeaderId),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        var childMemberships = dbContext.GroupMemberships
            .Where(x => x.GroupId == childId)
            .ToDictionary(x => x.MemberId);
        Assert.Equal(MembershipRole.Leader, childMemberships[newLeaderId].Role);
        Assert.Equal(MembershipStatus.Approved, childMemberships[newLeaderId].Status);
        Assert.Equal(MembershipRole.CoLeader, childMemberships[oldLeaderId].Role);
        Assert.Equal(MembershipStatus.Approved, childMemberships[oldLeaderId].Status);
        Assert.Single(childMemberships.Values, x => x.Role == MembershipRole.Leader);
        await cloudflareKvCacheService.Received(1).PutApprovedMembershipAsync(
            childId,
            newLeaderId,
            MembershipRole.Leader,
            Arg.Any<DateTime>(),
            Arg.Any<CancellationToken>());
        await cloudflareKvCacheService.Received(1).PutApprovedMembershipAsync(
            childId,
            oldLeaderId,
            MembershipRole.CoLeader,
            Arg.Any<DateTime>(),
            Arg.Any<CancellationToken>());
        await cloudflareKvCacheService.Received(1).RemoveApiCacheKeyAsync(
            $"member:{newLeaderId}:me",
            Arg.Any<CancellationToken>());
        await cloudflareKvCacheService.Received(1).RemoveApiCacheKeyAsync(
            $"member:{oldLeaderId}:me",
            Arg.Any<CancellationToken>());
        await cloudflareKvCacheService.Received(1).RemoveMemberProfileAsync(newLeaderId, Arg.Any<CancellationToken>());
        await cloudflareKvCacheService.Received(1).RemoveMemberProfileAsync(oldLeaderId, Arg.Any<CancellationToken>());
        await invalidationService.Received(1).RemoveSubgroupsAsync(parentId, Arg.Any<CancellationToken>());
        await invalidationService.Received(1).RemoveMembershipsAsync(childId, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task SetSubgroupLeader_RequiresTargetApprovedParentMembership()
    {
        using var dbContext = CreateInMemoryDbContext();
        var parentId = Guid.NewGuid();
        var childId = Guid.NewGuid();
        var parentManagerId = Guid.NewGuid();
        var newLeaderId = Guid.NewGuid();
        dbContext.Groups.AddRange(
            CreateGroup(parentId, AccessType.Protected),
            CreateGroup(childId, AccessType.Protected, parentId));
        await dbContext.SaveChangesAsync();

        var authorizationService = Substitute.For<IGroupAuthorizationService>();
        authorizationService.IsLeaderOrCoLeaderAsync(parentId, parentManagerId, Arg.Any<CancellationToken>()).Returns(true);
        var invalidationService = Substitute.For<IGroupCacheInvalidationService>();
        var cloudflareKvCacheService = Substitute.For<ICloudflareKvCacheService>();
        var handler = new SetSubgroupLeaderCommandHandler(
            dbContext,
            authorizationService,
            invalidationService,
            cloudflareKvCacheService);

        var result = await handler.Handle(
            new SetSubgroupLeaderCommand(parentId, childId, parentManagerId, newLeaderId),
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Empty(dbContext.GroupMemberships);
        await cloudflareKvCacheService.DidNotReceiveWithAnyArgs().PutApprovedMembershipAsync(
            default,
            default,
            default,
            default,
            default);
        await invalidationService.DidNotReceiveWithAnyArgs().RemoveMembershipsAsync(default, default);
    }

    [Fact]
    public async Task GetGroupInviteCandidates_ReturnsCurrentMembershipStatus()
    {
        using var dbContext = CreateInMemoryDbContext();
        var groupId = Guid.NewGuid();
        var leaderId = Guid.NewGuid();
        var invitedId = Guid.NewGuid();
        var requestedId = Guid.NewGuid();
        var approvedId = Guid.NewGuid();
        var rejectedId = Guid.NewGuid();
        var removedId = Guid.NewGuid();
        var neverJoinedId = Guid.NewGuid();
        var now = DateTime.UtcNow;

        dbContext.Groups.Add(CreateGroup(groupId, AccessType.Protected));
        dbContext.Members.AddRange(
            CreateMember(invitedId, "Invited"),
            CreateMember(requestedId, "Requested"),
            CreateMember(approvedId, "Approved"),
            CreateMember(rejectedId, "Rejected"),
            CreateMember(removedId, "Removed"),
            CreateMember(neverJoinedId, "Never Joined"));
        dbContext.GroupMemberships.AddRange(
            CreateMembership(groupId, invitedId, MembershipStatus.Invited, now),
            CreateMembership(groupId, requestedId, MembershipStatus.Requested, now),
            CreateMembership(groupId, approvedId, MembershipStatus.Approved, now),
            CreateMembership(groupId, rejectedId, MembershipStatus.Rejected, now),
            CreateMembership(groupId, removedId, MembershipStatus.Removed, now));
        await dbContext.SaveChangesAsync();

        var authorizationService = Substitute.For<IGroupAuthorizationService>();
        authorizationService.IsLeaderOrCoLeaderAsync(groupId, leaderId, Arg.Any<CancellationToken>()).Returns(true);
        var handler = new GetGroupInviteCandidatesQueryHandler(dbContext, authorizationService);

        var result = await handler.Handle(new GetGroupInviteCandidatesQuery(groupId, leaderId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var statuses = result.Value!.ToDictionary(x => x.DisplayName!, x => x.MembershipStatus);
        Assert.Equal("invited", statuses["Invited"]);
        Assert.Equal("requested", statuses["Requested"]);
        Assert.Equal("approved", statuses["Approved"]);
        Assert.Equal("rejected", statuses["Rejected"]);
        Assert.Equal("removed", statuses["Removed"]);
        Assert.Null(statuses["Never Joined"]);
    }

    [Fact]
    public async Task InviteGroupMemberById_ReinvitesRemovedMember()
    {
        using var dbContext = CreateInMemoryDbContext();
        var groupId = Guid.NewGuid();
        var leaderId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        dbContext.Groups.Add(CreateGroup(groupId, AccessType.Protected));
        dbContext.Members.Add(CreateMember(memberId, "Removed Member"));
        dbContext.GroupMemberships.Add(CreateMembership(groupId, memberId, MembershipStatus.Removed, DateTime.UtcNow.AddDays(-1)));
        await dbContext.SaveChangesAsync();

        var authorizationService = Substitute.For<IGroupAuthorizationService>();
        authorizationService.IsLeaderOrCoLeaderAsync(groupId, leaderId, Arg.Any<CancellationToken>()).Returns(true);
        var invalidationService = Substitute.For<IGroupCacheInvalidationService>();
        var cloudflareKvCacheService = Substitute.For<ICloudflareKvCacheService>();
        var handler = new InviteGroupMemberByIdCommandHandler(
            dbContext,
            authorizationService,
            invalidationService,
            cloudflareKvCacheService);

        var result = await handler.Handle(new InviteGroupMemberByIdCommand(groupId, leaderId, memberId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var membership = dbContext.GroupMemberships.Single();
        Assert.Equal(MembershipStatus.Invited, membership.Status);
        Assert.Equal(MembershipRole.Member, membership.Role);
        await cloudflareKvCacheService.Received(1).RemoveMembershipAsync(groupId, memberId, Arg.Any<CancellationToken>());
        await invalidationService.Received(1).RemoveMembershipsAsync(groupId, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task InviteGroupMemberById_NotifiesInvitedMember()
    {
        using var dbContext = CreateInMemoryDbContext();
        var groupId = Guid.NewGuid();
        var leaderId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        dbContext.Groups.Add(CreateGroup(groupId, AccessType.Protected));
        dbContext.Members.AddRange(CreateMember(leaderId, "Leader"), CreateMember(memberId, "Invitee"));
        await dbContext.SaveChangesAsync();

        var authorizationService = Substitute.For<IGroupAuthorizationService>();
        authorizationService.IsLeaderOrCoLeaderAsync(groupId, leaderId, Arg.Any<CancellationToken>()).Returns(true);
        var handler = new InviteGroupMemberByIdCommandHandler(
            dbContext,
            authorizationService,
            Substitute.For<IGroupCacheInvalidationService>(),
            Substitute.For<ICloudflareKvCacheService>());

        var result = await handler.Handle(new InviteGroupMemberByIdCommand(groupId, leaderId, memberId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var notification = await dbContext.NotificationMessages.SingleAsync();
        Assert.Equal(memberId, notification.RecipientMemberId);
        Assert.Equal(leaderId, notification.CreatedByMemberId);
        Assert.Equal(groupId, notification.GroupId);
        Assert.Equal("group.invitation.received", notification.ActionType);
        Assert.Contains("/profile", notification.ActionDataJson);
    }

    [Fact]
    public async Task SetGroupCoLeader_AllowsCoLeaderToPromoteApprovedMember()
    {
        using var dbContext = CreateInMemoryDbContext();
        var groupId = Guid.NewGuid();
        var coLeaderId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        dbContext.Groups.Add(CreateGroup(groupId, AccessType.Protected));
        dbContext.GroupMemberships.Add(new GroupMembership
        {
            Id = Guid.NewGuid(),
            GroupId = groupId,
            MemberId = memberId,
            Status = MembershipStatus.Approved,
            Role = MembershipRole.Member,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        });
        await dbContext.SaveChangesAsync();

        var authorizationService = Substitute.For<IGroupAuthorizationService>();
        authorizationService.IsLeaderOrCoLeaderAsync(groupId, coLeaderId, Arg.Any<CancellationToken>()).Returns(true);
        var cloudflareKvCacheService = Substitute.For<ICloudflareKvCacheService>();
        var invalidationService = Substitute.For<IGroupCacheInvalidationService>();
        var handler = new SetGroupCoLeaderCommandHandler(
            dbContext,
            authorizationService,
            invalidationService,
            cloudflareKvCacheService);

        var result = await handler.Handle(
            new SetGroupCoLeaderCommand(groupId, coLeaderId, memberId, true),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(MembershipRole.CoLeader, dbContext.GroupMemberships.Single().Role);
        await cloudflareKvCacheService.Received(1).PutApprovedMembershipAsync(
            groupId,
            memberId,
            MembershipRole.CoLeader,
            Arg.Any<DateTime>(),
            Arg.Any<CancellationToken>());
        await invalidationService.Received(1).RemoveMembershipsAsync(groupId, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task SetGroupCoLeader_NotifiesMemberWhenRoleChanges()
    {
        using var dbContext = CreateInMemoryDbContext();
        var groupId = Guid.NewGuid();
        var coLeaderId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        dbContext.Groups.Add(CreateGroup(groupId, AccessType.Protected));
        dbContext.Members.AddRange(CreateMember(coLeaderId, "Co Leader"), CreateMember(memberId, "Member"));
        dbContext.GroupMemberships.Add(CreateMembership(groupId, memberId, MembershipStatus.Approved, DateTime.UtcNow));
        await dbContext.SaveChangesAsync();

        var authorizationService = Substitute.For<IGroupAuthorizationService>();
        authorizationService.IsLeaderOrCoLeaderAsync(groupId, coLeaderId, Arg.Any<CancellationToken>()).Returns(true);
        var handler = new SetGroupCoLeaderCommandHandler(
            dbContext,
            authorizationService,
            Substitute.For<IGroupCacheInvalidationService>(),
            Substitute.For<ICloudflareKvCacheService>());

        var result = await handler.Handle(
            new SetGroupCoLeaderCommand(groupId, coLeaderId, memberId, true),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        var notification = await dbContext.NotificationMessages.SingleAsync();
        Assert.Equal(memberId, notification.RecipientMemberId);
        Assert.Equal(coLeaderId, notification.CreatedByMemberId);
        Assert.Equal(groupId, notification.GroupId);
        Assert.Equal("group.member.promoted-to-coleader", notification.ActionType);
        Assert.Contains("coLeader", notification.ActionDataJson);
    }

    [Fact]
    public async Task KickGroupMember_NotifiesRemovedMember()
    {
        using var dbContext = CreateInMemoryDbContext();
        var groupId = Guid.NewGuid();
        var leaderId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        dbContext.Groups.Add(CreateGroup(groupId, AccessType.Protected));
        dbContext.Members.AddRange(CreateMember(leaderId, "Leader"), CreateMember(memberId, "Member"));
        dbContext.GroupMemberships.Add(CreateMembership(groupId, memberId, MembershipStatus.Approved, DateTime.UtcNow));
        await dbContext.SaveChangesAsync();

        var authorizationService = Substitute.For<IGroupAuthorizationService>();
        authorizationService.IsLeaderOrCoLeaderAsync(groupId, leaderId, Arg.Any<CancellationToken>()).Returns(true);
        var handler = new KickGroupMemberCommandHandler(
            dbContext,
            authorizationService,
            Substitute.For<IGroupCacheInvalidationService>(),
            Substitute.For<ICloudflareKvCacheService>());

        var result = await handler.Handle(new KickGroupMemberCommand(groupId, leaderId, memberId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var notification = await dbContext.NotificationMessages.SingleAsync();
        Assert.Equal(memberId, notification.RecipientMemberId);
        Assert.Equal(leaderId, notification.CreatedByMemberId);
        Assert.Equal(groupId, notification.GroupId);
        Assert.Equal("group.member.removed", notification.ActionType);
    }

    [Fact]
    public async Task SetGroupCoLeader_DoesNotChangePrimaryLeaderRole()
    {
        using var dbContext = CreateInMemoryDbContext();
        var groupId = Guid.NewGuid();
        var coLeaderId = Guid.NewGuid();
        var leaderId = Guid.NewGuid();
        dbContext.Groups.Add(CreateGroup(groupId, AccessType.Protected));
        dbContext.GroupMemberships.Add(new GroupMembership
        {
            Id = Guid.NewGuid(),
            GroupId = groupId,
            MemberId = leaderId,
            Status = MembershipStatus.Approved,
            Role = MembershipRole.Leader,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        });
        await dbContext.SaveChangesAsync();

        var authorizationService = Substitute.For<IGroupAuthorizationService>();
        authorizationService.IsLeaderOrCoLeaderAsync(groupId, coLeaderId, Arg.Any<CancellationToken>()).Returns(true);
        var cloudflareKvCacheService = Substitute.For<ICloudflareKvCacheService>();
        var invalidationService = Substitute.For<IGroupCacheInvalidationService>();
        var handler = new SetGroupCoLeaderCommandHandler(
            dbContext,
            authorizationService,
            invalidationService,
            cloudflareKvCacheService);

        var result = await handler.Handle(
            new SetGroupCoLeaderCommand(groupId, coLeaderId, leaderId, false),
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(MembershipRole.Leader, dbContext.GroupMemberships.Single().Role);
        await cloudflareKvCacheService.DidNotReceiveWithAnyArgs().PutApprovedMembershipAsync(
            default,
            default,
            default,
            default,
            default);
        await invalidationService.DidNotReceiveWithAnyArgs().RemoveMembershipsAsync(default, default);
    }

    private static Group CreateGroup(
        Guid id,
        AccessType accessType,
        Guid? parentGroupId = null,
        bool isChurch = false)
        => new()
        {
            Id = id,
            NameJson = "{\"en\":\"Group\"}",
            ParentGroupId = parentGroupId,
            AccessType = accessType,
            IsChurch = isChurch,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        };

    private static Member CreateMember(Guid id, string displayName)
        => new()
        {
            Id = id,
            DisplayName = displayName,
            IsRegistered = true,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        };

    private static GroupMembership CreateMembership(
        Guid groupId,
        Guid memberId,
        MembershipStatus status,
        DateTime updatedUtc,
        MembershipRole role = MembershipRole.Member)
        => new()
        {
            Id = Guid.NewGuid(),
            GroupId = groupId,
            MemberId = memberId,
            Status = status,
            Role = role,
            CreatedUtc = updatedUtc,
            UpdatedUtc = updatedUtc
        };

    private static AlifeDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AlifeDbContext(options);
    }
}
