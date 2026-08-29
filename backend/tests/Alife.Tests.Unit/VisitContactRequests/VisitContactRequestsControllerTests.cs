using Alife.Api.Controllers;
using Alife.Application.Common.Models;
using Alife.Application.IdentityAccess;
using Alife.Application.VisitContactRequests.Commands.CreateVisitContactRequest;
using Alife.Application.VisitContactRequests.Dtos;
using MediatR;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
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
        var rateLimiter = Substitute.For<IServerRateLimiter>();
        rateLimiter
            .TryConsumeAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<int>(), Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>())
            .Returns(new RateLimitDecision(true, now.AddHours(1), 2));
        var controller = new VisitContactRequestsController(
            mediator,
            rateLimiter,
            new ConfigurationBuilder().Build())
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
                "/contact",
                PrivacyConsent: true,
                PrivacyConsentVersion: "2026-08",
                FormStartedUnixMilliseconds: DateTimeOffset.UtcNow.AddSeconds(-3).ToUnixTimeMilliseconds()),
            CancellationToken.None);

        var created = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status201Created, created.StatusCode);
        Assert.Equal("private, no-store", controller.Response.Headers.CacheControl.ToString());
        Assert.Contains("Cookie", controller.Response.Headers.Vary.ToString());
        Assert.Contains("Authorization", controller.Response.Headers.Vary.ToString());
        Assert.Equal("no-cache", controller.Response.Headers.Pragma.ToString());
        await mediator.Received(1).Send(
            Arg.Is<CreateVisitContactRequestCommand>(command => command.Salutation == "Sister Anna"),
            Arg.Any<CancellationToken>());
    }
}
