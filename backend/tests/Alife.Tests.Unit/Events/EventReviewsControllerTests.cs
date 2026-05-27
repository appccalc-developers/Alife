using Alife.Api.Controllers;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Events.Dtos;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using System.Text.Json;

namespace Alife.Tests.Unit.Events;

public class EventReviewsControllerTests
{
    private static AlifeDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AlifeDbContext(options);
    }

    [Fact]
    public async Task Create_WhenApprovedMember_CreatesReview()
    {
        using var dbContext = CreateInMemoryDbContext();
        var groupId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        var eventId = Guid.NewGuid();
        await SeedEventAsync(dbContext, groupId, memberId, eventId);

        var currentMemberAccessor = Substitute.For<ICurrentMemberAccessor>();
        currentMemberAccessor.GetCurrentMemberId().Returns(memberId);
        var groupAuthorizationService = Substitute.For<IGroupAuthorizationService>();
        groupAuthorizationService
            .IsApprovedMemberAsync(groupId, memberId, Arg.Any<CancellationToken>())
            .Returns(true);
        var controller = new EventReviewsController(dbContext, currentMemberAccessor, groupAuthorizationService);
        var reviewId = Guid.NewGuid();
        var payload = JsonDocument.Parse($"{{\"reviewId\":\"{reviewId}\",\"reflection\":{{\"en\":\"Good\",\"zh\":\"好\"}}}}").RootElement;

        var result = await controller.Create(eventId, payload, CancellationToken.None);

        var created = Assert.IsType<CreatedAtActionResult>(result);
        var dto = Assert.IsType<EventReviewDto>(created.Value);
        Assert.Equal(reviewId, dto.Id);
        Assert.Equal(groupId, dto.GroupId);
        Assert.Equal(eventId, dto.EventId);
        Assert.Equal(memberId, dto.MemberId);
        Assert.Equal(1, await dbContext.EventReviews.CountAsync());
    }

    [Fact]
    public async Task Create_WhenReviewAlreadyExists_ReturnsConflict()
    {
        using var dbContext = CreateInMemoryDbContext();
        var groupId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        var eventId = Guid.NewGuid();
        await SeedEventAsync(dbContext, groupId, memberId, eventId);
        dbContext.EventReviews.Add(new EventReview
        {
            Id = Guid.NewGuid(),
            GroupId = groupId,
            EventId = eventId,
            MemberId = memberId,
            ReviewJson = "{}",
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow,
        });
        await dbContext.SaveChangesAsync();

        var currentMemberAccessor = Substitute.For<ICurrentMemberAccessor>();
        currentMemberAccessor.GetCurrentMemberId().Returns(memberId);
        var groupAuthorizationService = Substitute.For<IGroupAuthorizationService>();
        groupAuthorizationService
            .IsApprovedMemberAsync(groupId, memberId, Arg.Any<CancellationToken>())
            .Returns(true);
        var controller = new EventReviewsController(dbContext, currentMemberAccessor, groupAuthorizationService);
        var payload = JsonDocument.Parse("""{"reflection":{"en":"Good","zh":"好"}}""").RootElement;

        var result = await controller.Create(eventId, payload, CancellationToken.None);

        Assert.IsType<ConflictObjectResult>(result);
    }

    [Fact]
    public async Task List_WhenMember_ReturnsOnlyOwnReviews()
    {
        using var dbContext = CreateInMemoryDbContext();
        var groupId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        var otherMemberId = Guid.NewGuid();
        var eventId = Guid.NewGuid();
        await SeedEventAsync(dbContext, groupId, memberId, eventId);
        await SeedReviewAsync(dbContext, groupId, eventId, memberId, "{\"owner\":true}");
        await SeedReviewAsync(dbContext, groupId, eventId, otherMemberId, "{\"owner\":false}");

        var currentMemberAccessor = Substitute.For<ICurrentMemberAccessor>();
        currentMemberAccessor.GetCurrentMemberId().Returns(memberId);
        var groupAuthorizationService = Substitute.For<IGroupAuthorizationService>();
        groupAuthorizationService
            .IsLeaderOrCoLeaderAsync(groupId, memberId, Arg.Any<CancellationToken>())
            .Returns(false);
        groupAuthorizationService
            .IsApprovedMemberAsync(groupId, memberId, Arg.Any<CancellationToken>())
            .Returns(true);
        var controller = new EventReviewsController(dbContext, currentMemberAccessor, groupAuthorizationService);

        var result = await controller.List(eventId, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var reviews = Assert.IsAssignableFrom<IEnumerable<EventReviewDto>>(ok.Value).ToList();
        Assert.Single(reviews);
        Assert.Equal(memberId, reviews[0].MemberId);
    }

    [Fact]
    public async Task List_WhenLeader_ReturnsAllReviews()
    {
        using var dbContext = CreateInMemoryDbContext();
        var groupId = Guid.NewGuid();
        var leaderId = Guid.NewGuid();
        var otherMemberId = Guid.NewGuid();
        var eventId = Guid.NewGuid();
        await SeedEventAsync(dbContext, groupId, leaderId, eventId);
        await SeedReviewAsync(dbContext, groupId, eventId, leaderId, "{\"leader\":true}");
        await SeedReviewAsync(dbContext, groupId, eventId, otherMemberId, "{\"leader\":false}");

        var currentMemberAccessor = Substitute.For<ICurrentMemberAccessor>();
        currentMemberAccessor.GetCurrentMemberId().Returns(leaderId);
        var groupAuthorizationService = Substitute.For<IGroupAuthorizationService>();
        groupAuthorizationService
            .IsLeaderOrCoLeaderAsync(groupId, leaderId, Arg.Any<CancellationToken>())
            .Returns(true);
        var controller = new EventReviewsController(dbContext, currentMemberAccessor, groupAuthorizationService);

        var result = await controller.List(eventId, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var reviews = Assert.IsAssignableFrom<IEnumerable<EventReviewDto>>(ok.Value).ToList();
        Assert.Equal(2, reviews.Count);
    }

    [Fact]
    public async Task Delete_WhenUnrelatedMember_ReturnsForbid()
    {
        using var dbContext = CreateInMemoryDbContext();
        var groupId = Guid.NewGuid();
        var ownerId = Guid.NewGuid();
        var otherMemberId = Guid.NewGuid();
        var eventId = Guid.NewGuid();
        await SeedEventAsync(dbContext, groupId, ownerId, eventId);
        var review = await SeedReviewAsync(dbContext, groupId, eventId, ownerId, "{}");

        var currentMemberAccessor = Substitute.For<ICurrentMemberAccessor>();
        currentMemberAccessor.GetCurrentMemberId().Returns(otherMemberId);
        var groupAuthorizationService = Substitute.For<IGroupAuthorizationService>();
        groupAuthorizationService
            .IsLeaderOrCoLeaderAsync(groupId, otherMemberId, Arg.Any<CancellationToken>())
            .Returns(false);
        var controller = new EventReviewsController(dbContext, currentMemberAccessor, groupAuthorizationService);

        var result = await controller.Delete(eventId, review.Id, CancellationToken.None);

        Assert.IsType<ForbidResult>(result);
    }

    private static async Task SeedEventAsync(AlifeDbContext dbContext, Guid groupId, Guid memberId, Guid eventId)
    {
        dbContext.GroupEvents.Add(new GroupEvent
        {
            Id = eventId,
            GroupId = groupId,
            CreatedByMemberId = memberId,
            TitleEn = "Camp",
            TitleZh = "营会",
            StartDate = DateTime.UtcNow,
            EndDate = DateTime.UtcNow.AddHours(1),
            EventDataJson = "{}",
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow,
        });
        await dbContext.SaveChangesAsync();
    }

    private static async Task<EventReview> SeedReviewAsync(
        AlifeDbContext dbContext,
        Guid groupId,
        Guid eventId,
        Guid memberId,
        string reviewJson)
    {
        var review = new EventReview
        {
            Id = Guid.NewGuid(),
            GroupId = groupId,
            EventId = eventId,
            MemberId = memberId,
            ReviewJson = reviewJson,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow,
        };
        dbContext.EventReviews.Add(review);
        await dbContext.SaveChangesAsync();
        return review;
    }
}
