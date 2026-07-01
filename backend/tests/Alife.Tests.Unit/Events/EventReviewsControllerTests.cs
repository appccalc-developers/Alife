using Alife.Api.Controllers;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Common.Models;
using Alife.Application.Events.Commands.CreateEventReview;
using Alife.Application.Events.Commands.DeleteEventReview;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Queries.ListEventReviews;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using NSubstitute;
using System.Text.Json;

namespace Alife.Tests.Unit.Events;

public class EventReviewsControllerTests
{
    [Fact]
    public async Task Create_WhenApprovedMember_CreatesReview()
    {
        var groupId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        var eventId = Guid.NewGuid();
        var reviewId = Guid.NewGuid();
        var mediator = Substitute.For<IMediator>();
        var currentMemberAccessor = Substitute.For<ICurrentMemberAccessor>();
        currentMemberAccessor.GetCurrentMemberId().Returns(memberId);
        mediator
            .Send(Arg.Any<CreateEventReviewCommand>(), Arg.Any<CancellationToken>())
            .Returns(AppResult<EventReviewDto>.Success(CreateReview(reviewId, groupId, eventId, memberId)));
        var controller = new EventReviewsController(mediator, currentMemberAccessor);
        var payload = JsonDocument.Parse($"{{\"reviewId\":\"{reviewId}\",\"reflection\":{{\"en\":\"Good\",\"zh\":\"hao\"}}}}").RootElement;

        var result = await controller.Create(eventId, payload, CancellationToken.None);

        var created = Assert.IsType<CreatedAtActionResult>(result);
        var dto = Assert.IsType<EventReviewDto>(created.Value);
        Assert.Equal(reviewId, dto.Id);
        Assert.Equal(groupId, dto.GroupId);
        Assert.Equal(eventId, dto.EventId);
        Assert.Equal(memberId, dto.MemberId);
    }

    [Fact]
    public async Task Create_WhenCommandReturnsConflict_ReturnsConflict()
    {
        var memberId = Guid.NewGuid();
        var eventId = Guid.NewGuid();
        var mediator = Substitute.For<IMediator>();
        var currentMemberAccessor = Substitute.For<ICurrentMemberAccessor>();
        currentMemberAccessor.GetCurrentMemberId().Returns(memberId);
        mediator
            .Send(Arg.Any<CreateEventReviewCommand>(), Arg.Any<CancellationToken>())
            .Returns(AppResult<EventReviewDto>.Conflict("Review id already exists."));
        var controller = new EventReviewsController(mediator, currentMemberAccessor);
        var payload = JsonDocument.Parse("""{"reflection":{"en":"Good","zh":"hao"}}""").RootElement;

        var result = await controller.Create(eventId, payload, CancellationToken.None);

        Assert.IsType<ConflictObjectResult>(result);
    }

    [Fact]
    public async Task List_WhenMember_ReturnsAllReviews()
    {
        var groupId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        var eventId = Guid.NewGuid();
        var mediator = Substitute.For<IMediator>();
        var currentMemberAccessor = Substitute.For<ICurrentMemberAccessor>();
        currentMemberAccessor.GetCurrentMemberId().Returns(memberId);
        mediator
            .Send(Arg.Any<ListEventReviewsQuery>(), Arg.Any<CancellationToken>())
            .Returns(AppResult<IReadOnlyList<EventReviewDto>>.Success([
                CreateReview(Guid.NewGuid(), groupId, eventId, memberId),
                CreateReview(Guid.NewGuid(), groupId, eventId, Guid.NewGuid())
            ]));
        var controller = new EventReviewsController(mediator, currentMemberAccessor);

        var result = await controller.List(eventId, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var reviews = Assert.IsAssignableFrom<IEnumerable<EventReviewDto>>(ok.Value).ToList();
        Assert.Equal(2, reviews.Count);
    }

    [Fact]
    public async Task List_WhenLeader_ReturnsAllReviews()
    {
        var groupId = Guid.NewGuid();
        var leaderId = Guid.NewGuid();
        var eventId = Guid.NewGuid();
        var mediator = Substitute.For<IMediator>();
        var currentMemberAccessor = Substitute.For<ICurrentMemberAccessor>();
        currentMemberAccessor.GetCurrentMemberId().Returns(leaderId);
        mediator
            .Send(Arg.Any<ListEventReviewsQuery>(), Arg.Any<CancellationToken>())
            .Returns(AppResult<IReadOnlyList<EventReviewDto>>.Success([
                CreateReview(Guid.NewGuid(), groupId, eventId, leaderId),
                CreateReview(Guid.NewGuid(), groupId, eventId, Guid.NewGuid())
            ]));
        var controller = new EventReviewsController(mediator, currentMemberAccessor);

        var result = await controller.List(eventId, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var reviews = Assert.IsAssignableFrom<IEnumerable<EventReviewDto>>(ok.Value).ToList();
        Assert.Equal(2, reviews.Count);
    }

    [Fact]
    public async Task Delete_WhenUnrelatedMember_ReturnsForbid()
    {
        var memberId = Guid.NewGuid();
        var eventId = Guid.NewGuid();
        var reviewId = Guid.NewGuid();
        var mediator = Substitute.For<IMediator>();
        var currentMemberAccessor = Substitute.For<ICurrentMemberAccessor>();
        currentMemberAccessor.GetCurrentMemberId().Returns(memberId);
        mediator
            .Send(Arg.Any<DeleteEventReviewCommand>(), Arg.Any<CancellationToken>())
            .Returns(AppResult<bool>.Forbidden("You do not have permission to delete this review."));
        var controller = new EventReviewsController(mediator, currentMemberAccessor);

        var result = await controller.Delete(eventId, reviewId, CancellationToken.None);

        var forbidden = Assert.IsType<ObjectResult>(result);
        Assert.Equal(403, forbidden.StatusCode);
    }

    private static EventReviewDto CreateReview(Guid reviewId, Guid groupId, Guid eventId, Guid memberId)
        => new(
            reviewId,
            groupId,
            eventId,
            memberId,
            "{}",
            DateTime.UtcNow,
            DateTime.UtcNow);
}
