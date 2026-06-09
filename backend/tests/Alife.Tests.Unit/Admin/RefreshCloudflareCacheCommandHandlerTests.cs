using Alife.Application.Admin.Commands.RefreshCloudflareCache;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Dtos;
using Alife.Application.Groups.Services;
using Alife.Application.Pages.Services;
using Alife.Application.Sermons.Services;
using Alife.Domain.Enums;
using NSubstitute;

namespace Alife.Tests.Unit.Admin;

public class RefreshCloudflareCacheCommandHandlerTests
{
    [Fact]
    public async Task Handle_ReturnsForbidden_WhenMemberIsNotAdmin()
    {
        var currentMemberId = Guid.NewGuid();
        var groupId = Guid.NewGuid();
        var authorizationService = Substitute.For<IGroupAuthorizationService>();
        var groupReadService = Substitute.For<IGroupReadService>();
        var groupCache = Substitute.For<IGroupCacheInvalidationService>();
        var pageCache = Substitute.For<IPageCacheInvalidationService>();
        var eventCache = Substitute.For<IEventCacheInvalidationService>();
        var sermonCache = Substitute.For<ISermonCacheInvalidationService>();

        authorizationService.IsAdminAsync(currentMemberId, Arg.Any<CancellationToken>()).Returns(false);
        var handler = new RefreshCloudflareCacheCommandHandler(
            authorizationService,
            groupReadService,
            groupCache,
            pageCache,
            eventCache,
            sermonCache);

        var result = await handler.Handle(
            new RefreshCloudflareCacheCommand(currentMemberId, groupId),
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        await groupReadService.DidNotReceive().GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
        await groupCache.DidNotReceive().RemoveGroupAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_InvalidatesChurchCaches_WhenMemberIsAdminAndGroupIsChurch()
    {
        var currentMemberId = Guid.NewGuid();
        var groupId = Guid.NewGuid();
        var authorizationService = Substitute.For<IGroupAuthorizationService>();
        var groupReadService = Substitute.For<IGroupReadService>();
        var groupCache = Substitute.For<IGroupCacheInvalidationService>();
        var pageCache = Substitute.For<IPageCacheInvalidationService>();
        var eventCache = Substitute.For<IEventCacheInvalidationService>();
        var sermonCache = Substitute.For<ISermonCacheInvalidationService>();

        authorizationService.IsAdminAsync(currentMemberId, Arg.Any<CancellationToken>()).Returns(true);
        groupReadService.GetByIdAsync(groupId, Arg.Any<CancellationToken>()).Returns(CreateGroup(groupId, isChurch: true));
        var handler = new RefreshCloudflareCacheCommandHandler(
            authorizationService,
            groupReadService,
            groupCache,
            pageCache,
            eventCache,
            sermonCache);

        var result = await handler.Handle(
            new RefreshCloudflareCacheCommand(currentMemberId, groupId),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        await groupCache.Received(1).RemoveChurchAsync(Arg.Any<CancellationToken>());
        await groupCache.Received(1).RemoveGroupAsync(groupId, Arg.Any<CancellationToken>());
        await groupCache.Received(1).RemoveSubgroupsAsync(groupId, Arg.Any<CancellationToken>());
        await groupCache.Received(1).RemoveMembershipsAsync(groupId, Arg.Any<CancellationToken>());
        await pageCache.Received(1).RemoveGlobalAsync(Arg.Any<CancellationToken>());
        await pageCache.Received(1).RemoveGroupPagesAsync(groupId, Arg.Any<CancellationToken>());
        await eventCache.Received(1).RemoveGroupEventsAsync(groupId, Arg.Any<CancellationToken>());
        await sermonCache.Received(1).RemoveAllAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ReturnsValidation_WhenGroupIsNotChurch()
    {
        var currentMemberId = Guid.NewGuid();
        var groupId = Guid.NewGuid();
        var authorizationService = Substitute.For<IGroupAuthorizationService>();
        var groupReadService = Substitute.For<IGroupReadService>();
        var groupCache = Substitute.For<IGroupCacheInvalidationService>();
        var pageCache = Substitute.For<IPageCacheInvalidationService>();
        var eventCache = Substitute.For<IEventCacheInvalidationService>();
        var sermonCache = Substitute.For<ISermonCacheInvalidationService>();

        authorizationService.IsAdminAsync(currentMemberId, Arg.Any<CancellationToken>()).Returns(true);
        groupReadService.GetByIdAsync(groupId, Arg.Any<CancellationToken>()).Returns(CreateGroup(groupId, isChurch: false));
        var handler = new RefreshCloudflareCacheCommandHandler(
            authorizationService,
            groupReadService,
            groupCache,
            pageCache,
            eventCache,
            sermonCache);

        var result = await handler.Handle(
            new RefreshCloudflareCacheCommand(currentMemberId, groupId),
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        await groupCache.DidNotReceive().RemoveGroupAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
        await sermonCache.DidNotReceive().RemoveAllAsync(Arg.Any<CancellationToken>());
    }

    private static GroupDto CreateGroup(Guid groupId, bool isChurch)
        => new(
            groupId,
            new Dictionary<string, string> { ["en"] = "Test Church" },
            null,
            null,
            AccessType.Public,
            isChurch,
            false,
            DateTime.UtcNow,
            DateTime.UtcNow);
}
