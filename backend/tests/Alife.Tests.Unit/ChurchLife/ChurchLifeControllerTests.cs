using Alife.Api.Controllers;
using Alife.Application.Abstractions.Identity;
using Alife.Application.ChurchLife;
using Alife.Application.Common.Models;
using Alife.Application.Pages.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NSubstitute;

namespace Alife.Tests.Unit.ChurchLife;

public sealed class ChurchLifeControllerTests
{
    [Fact]
    public async Task Pages_RequiresAuthorizationAndReturnsViewerScopedCacheHeaders()
    {
        var memberId = Guid.NewGuid();
        var churchLife = Substitute.For<IChurchLifeService>();
        var currentMember = Substitute.For<ICurrentMemberAccessor>();
        currentMember.GetCurrentMemberId().Returns(memberId);
        churchLife.ListPagesAsync(memberId, null, Arg.Any<CancellationToken>())
            .Returns(AppResult<ChurchLifeListDto<PageDto>>.Success(new ChurchLifeListDto<PageDto>([], [])));
        var controller = new ChurchLifeController(churchLife, currentMember)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() },
        };

        var result = await controller.Pages(null, CancellationToken.None);

        Assert.IsType<OkObjectResult>(result);
        Assert.NotNull(typeof(ChurchLifeController).GetCustomAttributes(typeof(AuthorizeAttribute), true).SingleOrDefault());
        Assert.Equal("private, no-cache", controller.Response.Headers.CacheControl.ToString());
        Assert.Contains("Cookie", controller.Response.Headers.Vary.ToString());
        Assert.Contains("Authorization", controller.Response.Headers.Vary.ToString());
    }

    [Fact]
    public async Task Pages_WithoutPrincipalReturnsUnauthorizedWithoutCallingService()
    {
        var churchLife = Substitute.For<IChurchLifeService>();
        var controller = new ChurchLifeController(churchLife, Substitute.For<ICurrentMemberAccessor>());

        var result = await controller.Pages(null, CancellationToken.None);

        Assert.IsType<UnauthorizedResult>(result);
        await churchLife.DidNotReceiveWithAnyArgs().ListPagesAsync(default, default, default);
    }
}
