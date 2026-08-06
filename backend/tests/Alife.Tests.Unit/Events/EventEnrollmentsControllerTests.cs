using Alife.Api.Controllers;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Queries.ListEventEnrollments;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using NSubstitute;

namespace Alife.Tests.Unit.Events;

public class EventEnrollmentsControllerTests
{
    [Fact]
    public async Task List_WhenHandlerReturnsEnrollments_ReturnsPayload()
    {
        var memberId = Guid.NewGuid();
        var eventId = Guid.NewGuid();
        var mediator = Substitute.For<IMediator>();
        var currentMemberAccessor = Substitute.For<ICurrentMemberAccessor>();
        currentMemberAccessor.GetCurrentMemberId().Returns(memberId);
        mediator
            .Send(Arg.Any<ListEventEnrollmentsQuery>(), Arg.Any<CancellationToken>())
            .Returns(AppResult<IReadOnlyList<EventEnrollmentDto>>.Success([
                CreateEnrollment(eventId, memberId),
                CreateEnrollment(eventId, Guid.NewGuid())
            ]));
        var controller = new EventEnrollmentsController(mediator, currentMemberAccessor);

        var result = await controller.List(eventId, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var enrollments = Assert.IsAssignableFrom<IEnumerable<EventEnrollmentDto>>(ok.Value).ToList();
        Assert.Equal(2, enrollments.Count);
    }

    [Fact]
    public async Task List_WhenNonMember_ReturnsForbid()
    {
        var memberId = Guid.NewGuid();
        var eventId = Guid.NewGuid();
        var mediator = Substitute.For<IMediator>();
        var currentMemberAccessor = Substitute.For<ICurrentMemberAccessor>();
        currentMemberAccessor.GetCurrentMemberId().Returns(memberId);
        mediator
            .Send(Arg.Any<ListEventEnrollmentsQuery>(), Arg.Any<CancellationToken>())
            .Returns(AppResult<IReadOnlyList<EventEnrollmentDto>>.Forbidden("You must be an approved member to view enrollments."));
        var controller = new EventEnrollmentsController(mediator, currentMemberAccessor);

        var result = await controller.List(eventId, CancellationToken.None);

        var forbidden = Assert.IsType<ObjectResult>(result);
        Assert.Equal(403, forbidden.StatusCode);
    }

    private static EventEnrollmentDto CreateEnrollment(Guid eventId, Guid memberId)
        => new(
            Guid.NewGuid(),
            Guid.NewGuid(),
            eventId,
            memberId,
            "{}",
            DateTime.UtcNow,
            DateTime.UtcNow);
}
