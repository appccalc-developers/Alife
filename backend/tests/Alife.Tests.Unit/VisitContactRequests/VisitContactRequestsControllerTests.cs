using Alife.Api.Controllers;
using Alife.Application.Common.Models;
using Alife.Application.VisitContactRequests.Commands.CreateVisitContactRequest;
using Alife.Application.VisitContactRequests.Dtos;
using MediatR;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NSubstitute;

namespace Alife.Tests.Unit.VisitContactRequests;

public class VisitContactRequestsControllerTests
{
    [Fact]
    public async Task Create_ReturnsNoStoreResponseAndForwardsSalutation()
    {
        var now = DateTime.UtcNow;
        var dto = new VisitContactRequestDto(
            Guid.NewGuid(),
            "Visitor",
            "Sister Anna",
            "visitor@example.com",
            null,
            "en",
            "Please contact me.",
            "/contact",
            "new",
            now,
            null,
            null,
            null,
            now,
            now);
        var mediator = Substitute.For<IMediator>();
        mediator
            .Send(Arg.Any<CreateVisitContactRequestCommand>(), Arg.Any<CancellationToken>())
            .Returns(AppResult<VisitContactRequestDto>.Success(dto));
        var controller = new VisitContactRequestsController(mediator)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
            }
        };

        var result = await controller.Create(
            new VisitContactRequestsController.CreateVisitContactRequestRequest(
                "Visitor",
                "Sister Anna",
                "visitor@example.com",
                null,
                "en",
                "Please contact me.",
                "/contact"),
            CancellationToken.None);

        var created = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status201Created, created.StatusCode);
        Assert.Equal("no-store", controller.Response.Headers.CacheControl.ToString());
        Assert.Equal("no-cache", controller.Response.Headers.Pragma.ToString());
        await mediator.Received(1).Send(
            Arg.Is<CreateVisitContactRequestCommand>(command => command.Salutation == "Sister Anna"),
            Arg.Any<CancellationToken>());
    }
}
