using Alife.Application.Groups.Dtos;
using Alife.Application.Groups.Queries.GetVisibleGroups;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Alife.Infrastructure.ReadServices;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Hybrid;
using Microsoft.Extensions.DependencyInjection;
using NSubstitute;

namespace Alife.Tests.Unit.Groups;

public class GetVisibleGroupsTests
{
    [Fact]
    public async Task Handle_RegisteredMember_ReturnsVisibleGroups()
    {
        var memberId = Guid.NewGuid();
        var groups = new[]
        {
            new GroupSummaryDto(
                Guid.NewGuid(),
                new Dictionary<string, string> { ["en"] = "Church" },
                null,
                null,
                AccessType.Protected,
                IsChurch: true,
                IsClosed: false)
        };
        var readService = Substitute.For<IGroupReadService>();
        var authorizationService = Substitute.For<IGroupAuthorizationService>();
        authorizationService.IsRegisteredMemberAsync(memberId, Arg.Any<CancellationToken>())
            .Returns(true);
        readService.GetVisibleGroupsAsync(memberId, Arg.Any<CancellationToken>())
            .Returns(groups);
        var handler = new GetVisibleGroupsQueryHandler(readService, authorizationService);

        var result = await handler.Handle(new GetVisibleGroupsQuery(memberId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(groups, result.Value);
    }

    [Fact]
    public async Task Handle_GuestMember_ReturnsForbidden()
    {
        var memberId = Guid.NewGuid();
        var readService = Substitute.For<IGroupReadService>();
        var authorizationService = Substitute.For<IGroupAuthorizationService>();
        authorizationService.IsRegisteredMemberAsync(memberId, Arg.Any<CancellationToken>())
            .Returns(false);
        var handler = new GetVisibleGroupsQueryHandler(readService, authorizationService);

        var result = await handler.Handle(new GetVisibleGroupsQuery(memberId), CancellationToken.None);

        Assert.False(result.IsSuccess);
        await readService.DidNotReceive()
            .GetVisibleGroupsAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_Anonymous_ReturnsPublicVisibleGroups()
    {
        var groups = new[]
        {
            new GroupSummaryDto(
                Guid.NewGuid(),
                new Dictionary<string, string> { ["en"] = "Public group" },
                null,
                null,
                AccessType.Public,
                IsChurch: false,
                IsClosed: false)
        };
        var readService = Substitute.For<IGroupReadService>();
        var authorizationService = Substitute.For<IGroupAuthorizationService>();
        readService.GetVisibleGroupsAsync(null, Arg.Any<CancellationToken>())
            .Returns(groups);
        var handler = new GetVisibleGroupsQueryHandler(readService, authorizationService);

        var result = await handler.Handle(new GetVisibleGroupsQuery(null), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(groups, result.Value);
        await authorizationService.DidNotReceive()
            .IsRegisteredMemberAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ReadService_Anonymous_IncludesRootChurchAndExcludesPrivateAndClosedGroups()
    {
        var churchId = Guid.NewGuid();
        var publicId = Guid.NewGuid();
        var protectedId = Guid.NewGuid();
        var privateId = Guid.NewGuid();
        var closedId = Guid.NewGuid();
        await using var dbContext = CreateDbContext();
        dbContext.Groups.AddRange(
            CreateGroup(churchId, "Root church", AccessType.Protected, isChurch: true),
            CreateGroup(publicId, "Public child", AccessType.Public, parentGroupId: churchId),
            CreateGroup(protectedId, "Protected child", AccessType.Protected, parentGroupId: churchId),
            CreateGroup(privateId, "Private child", AccessType.Private, parentGroupId: churchId),
            CreateGroup(closedId, "Closed child", AccessType.Public, parentGroupId: churchId, isClosed: true));
        await dbContext.SaveChangesAsync();
        using var services = CreateServices();
        var readService = new GroupReadService(dbContext, services.GetRequiredService<HybridCache>());

        var groups = await readService.GetVisibleGroupsAsync(null, CancellationToken.None);

        Assert.Equal(
            new[] { churchId, publicId, protectedId }.OrderBy(id => id),
            groups.Select(group => group.Id).OrderBy(id => id));
    }

    [Fact]
    public async Task ReadService_CachesDiscoverableGroups_ButReadsPrivateMembershipPerViewer()
    {
        var churchId = Guid.NewGuid();
        var publicId = Guid.NewGuid();
        var newPublicId = Guid.NewGuid();
        var privateId = Guid.NewGuid();
        var removedPrivateId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        await using var dbContext = CreateDbContext();
        dbContext.Groups.AddRange(
            CreateGroup(churchId, "Root church", AccessType.Protected, isChurch: true),
            CreateGroup(publicId, "Public child", AccessType.Public, parentGroupId: churchId));
        await dbContext.SaveChangesAsync();
        using var services = CreateServices();
        var hybridCache = services.GetRequiredService<HybridCache>();
        var readService = new GroupReadService(dbContext, hybridCache);

        var initial = await readService.GetVisibleGroupsAsync(null, CancellationToken.None);

        var privateGroup = CreateGroup(privateId, "Private child", AccessType.Private, parentGroupId: churchId);
        privateGroup.Memberships.Add(new GroupMembership
        {
            GroupId = privateId,
            MemberId = memberId,
            Status = MembershipStatus.Approved,
            Role = MembershipRole.Member,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        });
        var removedPrivateGroup = CreateGroup(removedPrivateId, "Removed private child", AccessType.Private, parentGroupId: churchId);
        removedPrivateGroup.Memberships.Add(new GroupMembership
        {
            GroupId = removedPrivateId,
            MemberId = memberId,
            Status = MembershipStatus.Removed,
            Role = MembershipRole.Member,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        });
        dbContext.Groups.AddRange(
            CreateGroup(newPublicId, "New public child", AccessType.Public, parentGroupId: churchId),
            privateGroup,
            removedPrivateGroup);
        await dbContext.SaveChangesAsync();

        var memberVisible = await readService.GetVisibleGroupsAsync(memberId, CancellationToken.None);

        Assert.Contains(initial, group => group.Id == publicId);
        Assert.DoesNotContain(memberVisible, group => group.Id == newPublicId);
        Assert.Contains(memberVisible, group => group.Id == privateId);
        Assert.DoesNotContain(memberVisible, group => group.Id == removedPrivateId);

        var kvCache = Substitute.For<Alife.Application.Common.Interfaces.ICloudflareKvCacheService>();
        var invalidation = new GroupCacheInvalidationService(hybridCache, kvCache);
        await invalidation.RemoveSubgroupsAsync(churchId);

        var refreshed = await readService.GetVisibleGroupsAsync(null, CancellationToken.None);

        Assert.Contains(refreshed, group => group.Id == newPublicId);
    }

    private static AlifeDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AlifeDbContext(options);
    }

    private static ServiceProvider CreateServices()
    {
        var services = new ServiceCollection();
        services.AddHybridCache();
        return services.BuildServiceProvider();
    }

    private static Group CreateGroup(
        Guid id,
        string name,
        AccessType accessType,
        Guid? parentGroupId = null,
        bool isChurch = false,
        bool isClosed = false) =>
        new()
        {
            Id = id,
            NameJson = $"{{\"en\":\"{name}\"}}",
            DescriptionJson = "{}",
            ParentGroupId = parentGroupId,
            AccessType = accessType,
            IsChurch = isChurch,
            IsClosed = isClosed,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        };
}
