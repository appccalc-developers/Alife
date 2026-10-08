using Alife.Api.Controllers;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Abstractions.Integrations;
using Alife.Application.Common.Models;
using Alife.Application.IdentityAccess;
using Alife.Application.Members.Commands.SaveBibleReadingProgress;
using Alife.Application.Members.Dtos;
using Alife.Application.Members.Queries.GetBibleReadingProgress;
using MediatR;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using NSubstitute;

namespace Alife.Tests.Unit.Members;

// Direct controller tests: these do not start the HTTP/authentication pipeline or a real database.
public sealed class BibleReadingProgressControllerTests
{
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task WithoutCurrentMember_ReadAndSaveRejectWithoutDispatch(bool save)
    {
        var mediator = Substitute.For<IMediator>();
        var controller = CreateController(mediator, null);

        var result = save
            ? await controller.SaveBibleReadingProgress(new("JHN", 3, "zh", "123", "206"), default)
            : await controller.GetBibleReadingProgress(default);

        Assert.IsType<UnauthorizedResult>(result);
        Assert.Empty(mediator.ReceivedCalls());
    }

    [Fact]
    public async Task Read_UsesCurrentMemberAndPreventsResponseStorage()
    {
        var memberId = Guid.NewGuid();
        var mediator = Substitute.For<IMediator>();
        var progress = new BibleReadingProgressDto("JHN", 3, "zh", "123", "206", DateTime.UtcNow);
        mediator.Send(Arg.Any<GetBibleReadingProgressQuery>(), Arg.Any<CancellationToken>())
            .Returns(AppResult<BibleReadingProgressDto>.Success(progress));
        var controller = CreateController(mediator, memberId);
        controller.Request.QueryString = new QueryString($"?memberId={Guid.NewGuid()}");

        var result = await controller.GetBibleReadingProgress(default);

        Assert.Same(progress, Assert.IsType<OkObjectResult>(result).Value);
        await mediator.Received(1).Send(
            Arg.Is<GetBibleReadingProgressQuery>(query => query.MemberId == memberId),
            Arg.Any<CancellationToken>());
        AssertNoStore(controller);
    }

    [Fact]
    public async Task Save_BindsPositionToCurrentMemberAndPreventsResponseStorage()
    {
        var memberId = Guid.NewGuid();
        var mediator = Substitute.For<IMediator>();
        var progress = new BibleReadingProgressDto("ACT", 4, "en", "46", "111", DateTime.UtcNow);
        mediator.Send(Arg.Any<SaveBibleReadingProgressCommand>(), Arg.Any<CancellationToken>())
            .Returns(AppResult<BibleReadingProgressDto>.Success(progress));
        var controller = CreateController(mediator, memberId);
        controller.Request.QueryString = new QueryString($"?memberId={Guid.NewGuid()}");

        var result = await controller.SaveBibleReadingProgress(new("ACT", 4, "en", "46", "111"), default);

        Assert.Same(progress, Assert.IsType<OkObjectResult>(result).Value);
        await mediator.Received(1).Send(
            Arg.Is<SaveBibleReadingProgressCommand>(command =>
                command.MemberId == memberId && command.Book == "ACT" && command.Chapter == 4 &&
                command.Language == "en" && command.ZhVersion == "46" && command.EnVersion == "111"),
            Arg.Any<CancellationToken>());
        AssertNoStore(controller);
    }

    [Fact]
    public async Task Read_WhenProgressIsMissing_ReturnsNonStored404()
    {
        var mediator = Substitute.For<IMediator>();
        mediator.Send(Arg.Any<GetBibleReadingProgressQuery>(), Arg.Any<CancellationToken>())
            .Returns(AppResult<BibleReadingProgressDto>.NotFound("Progress was not found."));
        var controller = CreateController(mediator, Guid.NewGuid());

        Assert.IsType<NotFoundObjectResult>(await controller.GetBibleReadingProgress(default));
        AssertNoStore(controller);
    }

    [Fact]
    public async Task Save_WhenPositionIsInvalid_ReturnsNonStored400()
    {
        var mediator = Substitute.For<IMediator>();
        mediator.Send(Arg.Any<SaveBibleReadingProgressCommand>(), Arg.Any<CancellationToken>())
            .Returns(AppResult<BibleReadingProgressDto>.Validation("Chapter is invalid."));
        var controller = CreateController(mediator, Guid.NewGuid());

        Assert.IsType<BadRequestObjectResult>(await controller.SaveBibleReadingProgress(new("JHN", 0, "zh", null, null), default));
        AssertNoStore(controller);
    }

    private static MembersController CreateController(IMediator mediator, Guid? memberId)
    {
        var accessor = Substitute.For<ICurrentMemberAccessor>();
        accessor.GetCurrentMemberId().Returns(memberId);
        return new MembersController(
            mediator, accessor, new ConfigurationBuilder().Build(),
            Substitute.For<ILineLoginService>(), Substitute.For<IIdentityAccessService>())
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };
    }

    private static void AssertNoStore(MembersController controller)
    {
        Assert.Equal("no-store", controller.Response.Headers.CacheControl);
        Assert.Equal("no-cache", controller.Response.Headers.Pragma);
    }
}
