using Alife.Api.Controllers;
using Alife.Application.Groups.Dtos;
using Alife.Application.Groups.Queries.GetChurch;
using Alife.Application.Groups.Services;
using Alife.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using NSubstitute;

namespace Alife.Tests.Unit.Groups;

public class GetChurchAccessTests
{
    [Fact]
    public async Task GetChurchQuery_ReturnsChurchWithoutMemberContext()
    {
        var churchId = Guid.NewGuid();
        var groupReadService = Substitute.For<IGroupReadService>();
        groupReadService.GetChurchAsync(Arg.Any<CancellationToken>())
            .Returns(CreateChurch(churchId));
        var handler = new GetChurchQueryHandler(groupReadService);

        var result = await handler.Handle(new GetChurchQuery(), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(churchId, result.Value!.Id);
    }

    [Fact]
    public void GetChurchEndpoint_AllowsAnonymousAccess()
    {
        var method = typeof(GroupsController).GetMethod(nameof(GroupsController.GetChurch));

        Assert.NotNull(method);
        Assert.Contains(method.GetCustomAttributes(inherit: true), x => x is AllowAnonymousAttribute);
    }

    private static GroupDto CreateChurch(Guid groupId)
        => new(
            groupId,
            new Dictionary<string, string> { ["en"] = "Church" },
            null,
            null,
            AccessType.Protected,
            IsChurch: true,
            IsClosed: false,
            DateTime.UtcNow,
            DateTime.UtcNow);
}
