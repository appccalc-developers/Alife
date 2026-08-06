using Alife.Application.Common.Models;
using Alife.Application.Events.Queries.ListEventEnrollments;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.Events;

public class ListEventEnrollmentsQueryHandlerTests
{
    [Fact]
    public async Task Handle_WhenApprovedMember_ReturnsOnlyOwnEnrollment()
    {
        using var dbContext = CreateInMemoryDbContext();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        var fixture = await SeedEventWithEnrollmentsAsync(dbContext);
        authorization
            .IsApprovedMemberAsync(fixture.GroupId, fixture.MemberId, Arg.Any<CancellationToken>())
            .Returns(true);
        authorization
            .IsLeaderOrCoLeaderAsync(fixture.GroupId, fixture.MemberId, Arg.Any<CancellationToken>())
            .Returns(false);
        var handler = new ListEventEnrollmentsQueryHandler(dbContext, authorization);

        var result = await handler.Handle(
            new ListEventEnrollmentsQuery(fixture.EventId, fixture.MemberId),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        var enrollment = Assert.Single(result.Value!);
        Assert.Equal(fixture.MemberId, enrollment.MemberId);
        Assert.DoesNotContain(result.Value!, item => item.MemberId == fixture.OtherMemberId);
    }

    [Fact]
    public async Task Handle_WhenGroupManager_ReturnsAllEnrollments()
    {
        using var dbContext = CreateInMemoryDbContext();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        var fixture = await SeedEventWithEnrollmentsAsync(dbContext);
        authorization
            .IsApprovedMemberAsync(fixture.GroupId, fixture.MemberId, Arg.Any<CancellationToken>())
            .Returns(true);
        authorization
            .IsLeaderOrCoLeaderAsync(fixture.GroupId, fixture.MemberId, Arg.Any<CancellationToken>())
            .Returns(true);
        var handler = new ListEventEnrollmentsQueryHandler(dbContext, authorization);

        var result = await handler.Handle(
            new ListEventEnrollmentsQuery(fixture.EventId, fixture.MemberId),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(2, result.Value!.Count);
    }

    [Fact]
    public async Task Handle_WhenApprovedEventCreator_ReturnsAllEnrollments()
    {
        using var dbContext = CreateInMemoryDbContext();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        var fixture = await SeedEventWithEnrollmentsAsync(dbContext);
        authorization
            .IsApprovedMemberAsync(fixture.GroupId, fixture.CreatorId, Arg.Any<CancellationToken>())
            .Returns(true);
        var handler = new ListEventEnrollmentsQueryHandler(dbContext, authorization);

        var result = await handler.Handle(
            new ListEventEnrollmentsQuery(fixture.EventId, fixture.CreatorId),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(2, result.Value!.Count);
        await authorization.DidNotReceive().IsLeaderOrCoLeaderAsync(
            Arg.Any<Guid>(),
            Arg.Any<Guid>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WhenEventCreatorIsNoLongerApproved_ReturnsForbidden()
    {
        using var dbContext = CreateInMemoryDbContext();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        var fixture = await SeedEventWithEnrollmentsAsync(dbContext);
        authorization
            .IsApprovedMemberAsync(fixture.GroupId, fixture.CreatorId, Arg.Any<CancellationToken>())
            .Returns(false);
        var handler = new ListEventEnrollmentsQueryHandler(dbContext, authorization);

        var result = await handler.Handle(
            new ListEventEnrollmentsQuery(fixture.EventId, fixture.CreatorId),
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(AppResultStatus.Forbidden, result.Status);
    }

    private static AlifeDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AlifeDbContext(options);
    }

    private static async Task<EnrollmentFixture> SeedEventWithEnrollmentsAsync(AlifeDbContext dbContext)
    {
        var fixture = new EnrollmentFixture(
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid());
        var now = DateTime.UtcNow;

        dbContext.GroupEvents.Add(new GroupEvent
        {
            Id = fixture.EventId,
            GroupId = fixture.GroupId,
            CreatedByMemberId = fixture.CreatorId,
            TitleEn = "Camp",
            TitleZh = "Camp zh",
            StartDate = now.AddDays(1),
            EndDate = now.AddDays(2),
            EventDataJson = "{}",
            CreatedUtc = now,
            UpdatedUtc = now
        });
        dbContext.EventEnrollments.AddRange(
            new EventEnrollment
            {
                Id = fixture.MemberEnrollmentId,
                GroupId = fixture.GroupId,
                EventId = fixture.EventId,
                MemberId = fixture.MemberId,
                EnrollmentJson = "{\"applicantName\":\"Member\"}",
                CreatedUtc = now,
                UpdatedUtc = now
            },
            new EventEnrollment
            {
                Id = Guid.NewGuid(),
                GroupId = fixture.GroupId,
                EventId = fixture.EventId,
                MemberId = fixture.OtherMemberId,
                EnrollmentJson = "{\"applicantName\":\"Other\"}",
                CreatedUtc = now,
                UpdatedUtc = now.AddMinutes(1)
            });
        await dbContext.SaveChangesAsync();
        return fixture;
    }

    private sealed record EnrollmentFixture(
        Guid GroupId,
        Guid EventId,
        Guid CreatorId,
        Guid MemberId,
        Guid OtherMemberId)
    {
        public Guid MemberEnrollmentId { get; } = Guid.NewGuid();
    }
}
