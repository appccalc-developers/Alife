using Alife.Application.Groups.Dtos;
using Alife.Application.Groups.Queries.GetVisibleGroups;
using Alife.Application.Groups.Services;
using Alife.Domain.Enums;
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
}
