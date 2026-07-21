using Alife.Application.Events.Commands.CreateEventReview;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.Events;

public class CreateEventReviewCommandHandlerTests
{
    private static AlifeDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AlifeDbContext(options);
    }

    [Fact]
    public async Task CreateEventReview_AllowsMultipleReviewsForSameEventAndMember()
    {
        using var dbContext = CreateInMemoryDbContext();
        var groupAuthorizationService = Substitute.For<IGroupAuthorizationService>();
        var eventCacheInvalidationService = Substitute.For<IEventCacheInvalidationService>();
        var groupId = Guid.NewGuid();
        var eventId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        var existingReviewId = Guid.NewGuid();
        var requestedReviewId = Guid.NewGuid();

        dbContext.GroupEvents.Add(new GroupEvent
        {
            Id = eventId,
            GroupId = groupId,
            CreatedByMemberId = memberId,
            TitleEn = "Event",
            TitleZh = "Event",
            StartDate = DateTime.UtcNow.AddHours(-2),
            EndDate = DateTime.UtcNow.AddHours(-1),
            EventDataJson = "{}",
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow,
        });
        dbContext.EventReviews.Add(new EventReview
        {
            Id = existingReviewId,
            GroupId = groupId,
            EventId = eventId,
            MemberId = memberId,
            ReviewJson = "{}",
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow,
        });
        await dbContext.SaveChangesAsync();

        groupAuthorizationService
            .IsApprovedMemberAsync(groupId, memberId, Arg.Any<CancellationToken>())
            .Returns(true);

        var handler = new CreateEventReviewCommandHandler(
            dbContext,
            groupAuthorizationService,
            eventCacheInvalidationService);

        var result = await handler.Handle(
            new CreateEventReviewCommand(
                eventId,
                memberId,
                $"{{\"reviewId\":\"{requestedReviewId}\",\"reflection\":{{\"en\":\"Again\",\"zh\":\"Again\"}}}}",
                requestedReviewId),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(requestedReviewId, result.Value?.Id);
        Assert.Equal(2, await dbContext.EventReviews.CountAsync(x => x.EventId == eventId && x.MemberId == memberId));
    }

    [Fact]
    public async Task CreateEventReview_RejectsReviewBeforeEventEnds()
    {
        using var dbContext = CreateInMemoryDbContext();
        var groupAuthorizationService = Substitute.For<IGroupAuthorizationService>();
        var eventCacheInvalidationService = Substitute.For<IEventCacheInvalidationService>();
        var groupId = Guid.NewGuid();
        var eventId = Guid.NewGuid();
        var memberId = Guid.NewGuid();

        dbContext.GroupEvents.Add(new GroupEvent
        {
            Id = eventId,
            GroupId = groupId,
            CreatedByMemberId = memberId,
            TitleEn = "Future event",
            TitleZh = "Future event",
            StartDate = DateTime.UtcNow.AddHours(1),
            EndDate = DateTime.UtcNow.AddHours(2),
            EventDataJson = "{}",
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow,
        });
        await dbContext.SaveChangesAsync();

        groupAuthorizationService
            .IsApprovedMemberAsync(groupId, memberId, Arg.Any<CancellationToken>())
            .Returns(true);

        var handler = new CreateEventReviewCommandHandler(
            dbContext,
            groupAuthorizationService,
            eventCacheInvalidationService);

        var result = await handler.Handle(
            new CreateEventReviewCommand(eventId, memberId, "{}", null),
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal("Reviews can only be added after the event has ended.", result.Message);
        Assert.Empty(dbContext.EventReviews);
    }
}
