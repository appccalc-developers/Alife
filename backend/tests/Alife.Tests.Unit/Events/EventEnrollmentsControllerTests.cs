using Alife.Api.Controllers;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.Events;

public class EventEnrollmentsControllerTests
{
    [Fact]
    public async Task List_WhenApprovedMember_ReturnsAllEnrollments()
    {
        using var dbContext = CreateInMemoryDbContext();
        var groupId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        var otherMemberId = Guid.NewGuid();
        var eventId = Guid.NewGuid();
        await SeedEventAsync(dbContext, groupId, memberId, eventId);
        await SeedEnrollmentAsync(dbContext, groupId, eventId, memberId, "{\"owner\":true}");
        await SeedEnrollmentAsync(dbContext, groupId, eventId, otherMemberId, "{\"owner\":false}");
        var currentMemberAccessor = Substitute.For<ICurrentMemberAccessor>();
        currentMemberAccessor.GetCurrentMemberId().Returns(memberId);
        var groupAuthorizationService = Substitute.For<IGroupAuthorizationService>();
        groupAuthorizationService.IsApprovedMemberAsync(groupId, memberId, Arg.Any<CancellationToken>())
            .Returns(true);
        var controller = new EventEnrollmentsController(
            dbContext,
            currentMemberAccessor,
            groupAuthorizationService,
            Substitute.For<IEventCacheInvalidationService>());

        var result = await controller.List(eventId, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var enrollments = Assert.IsAssignableFrom<IEnumerable<EventEnrollmentDto>>(ok.Value).ToList();
        Assert.Equal(2, enrollments.Count);
    }

    [Fact]
    public async Task List_WhenNonMember_ReturnsForbid()
    {
        using var dbContext = CreateInMemoryDbContext();
        var groupId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        var eventId = Guid.NewGuid();
        await SeedEventAsync(dbContext, groupId, memberId, eventId);
        var currentMemberAccessor = Substitute.For<ICurrentMemberAccessor>();
        currentMemberAccessor.GetCurrentMemberId().Returns(memberId);
        var groupAuthorizationService = Substitute.For<IGroupAuthorizationService>();
        groupAuthorizationService.IsApprovedMemberAsync(groupId, memberId, Arg.Any<CancellationToken>())
            .Returns(false);
        var controller = new EventEnrollmentsController(
            dbContext,
            currentMemberAccessor,
            groupAuthorizationService,
            Substitute.For<IEventCacheInvalidationService>());

        var result = await controller.List(eventId, CancellationToken.None);

        Assert.IsType<ForbidResult>(result);
    }

    private static AlifeDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AlifeDbContext(options);
    }

    private static async Task SeedEventAsync(AlifeDbContext dbContext, Guid groupId, Guid memberId, Guid eventId)
    {
        dbContext.GroupEvents.Add(new GroupEvent
        {
            Id = eventId,
            GroupId = groupId,
            CreatedByMemberId = memberId,
            TitleEn = "Camp",
            TitleZh = "Camp",
            StartDate = DateTime.UtcNow,
            EndDate = DateTime.UtcNow.AddHours(1),
            EventDataJson = "{}",
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow,
        });
        await dbContext.SaveChangesAsync();
    }

    private static async Task SeedEnrollmentAsync(
        AlifeDbContext dbContext,
        Guid groupId,
        Guid eventId,
        Guid memberId,
        string enrollmentJson)
    {
        dbContext.EventEnrollments.Add(new EventEnrollment
        {
            Id = Guid.NewGuid(),
            GroupId = groupId,
            EventId = eventId,
            MemberId = memberId,
            EnrollmentJson = enrollmentJson,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow,
        });
        await dbContext.SaveChangesAsync();
    }
}
