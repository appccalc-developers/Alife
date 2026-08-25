using Alife.Application.Events.Commands.EnrollGroupEvent;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Infrastructure.Persistence;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.Events;

public class EnrollGroupEventCommandHandlerTests
{
    private static AlifeDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AlifeDbContext(options);
    }

    [Fact]
    public async Task EnrollGroupEvent_WhenApprovedMember_CreatesEnrollment()
    {
        using var dbContext = CreateInMemoryDbContext();
        var groupAuthorizationService = Substitute.For<IGroupAuthorizationService>();
        var groupId = Guid.NewGuid();
        var currentMemberId = Guid.NewGuid();
        var eventId = Guid.NewGuid();

        dbContext.GroupEvents.Add(new GroupEvent
        {
            Id = eventId,
            GroupId = groupId,
            CreatedByMemberId = currentMemberId,
            TitleEn = "Camp",
            TitleZh = "營會",
            StartDate = DateTime.UtcNow.AddHours(1),
            EndDate = DateTime.UtcNow.AddHours(2),
            EventDataJson = $$"""{"registrationDeadline":"{{DateTime.UtcNow.AddMinutes(30):O}}","maxCapacity":20}""",
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow,
            RamAssessment = new EventRamAssessment
            {
                RamDataJson = "{}",
                Status = EventRamStatus.Approved,
                CreatedUtc = DateTime.UtcNow,
                UpdatedUtc = DateTime.UtcNow
            }
        });
        await dbContext.SaveChangesAsync();

        groupAuthorizationService
            .IsApprovedMemberAsync(groupId, currentMemberId, Arg.Any<CancellationToken>())
            .Returns(true);

        var handler = new EnrollGroupEventCommandHandler(dbContext, groupAuthorizationService);
        var payload = $"{{\"eventId\":\"{eventId}\",\"applicantName\":\"Alice\"}}";

        var result = await handler.Handle(
            new EnrollGroupEventCommand(groupId, currentMemberId, eventId, payload),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.NotNull(result.Value);
        Assert.Equal(eventId, result.Value.EventId);
        Assert.Equal(payload, result.Value.EnrollmentJson);
        Assert.Equal(1, await dbContext.EventEnrollments.CountAsync());
    }

    [Fact]
    public async Task EnrollGroupEvent_WhenSameMemberReEnrolls_UpdatesExistingEnrollment()
    {
        using var dbContext = CreateInMemoryDbContext();
        var groupAuthorizationService = Substitute.For<IGroupAuthorizationService>();
        var groupId = Guid.NewGuid();
        var currentMemberId = Guid.NewGuid();
        var eventId = Guid.NewGuid();
        var enrollmentId = Guid.NewGuid();

        dbContext.GroupEvents.Add(new GroupEvent
        {
            Id = eventId,
            GroupId = groupId,
            CreatedByMemberId = currentMemberId,
            TitleEn = "Camp",
            TitleZh = "營會",
            StartDate = DateTime.UtcNow.AddHours(1),
            EndDate = DateTime.UtcNow.AddHours(2),
            EventDataJson = $$"""{"registrationDeadline":"{{DateTime.UtcNow.AddMinutes(30):O}}","maxCapacity":20}""",
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow,
            RamAssessment = new EventRamAssessment
            {
                RamDataJson = "{}",
                Status = EventRamStatus.Approved,
                CreatedUtc = DateTime.UtcNow,
                UpdatedUtc = DateTime.UtcNow
            }
        });

        dbContext.EventEnrollments.Add(new EventEnrollment
        {
            Id = enrollmentId,
            GroupId = groupId,
            EventId = eventId,
            MemberId = currentMemberId,
            EnrollmentJson = "{\"eventId\":\"old\"}",
            CreatedUtc = DateTime.UtcNow.AddMinutes(-10),
            UpdatedUtc = DateTime.UtcNow.AddMinutes(-10),
        });
        await dbContext.SaveChangesAsync();

        groupAuthorizationService
            .IsApprovedMemberAsync(groupId, currentMemberId, Arg.Any<CancellationToken>())
            .Returns(true);

        var handler = new EnrollGroupEventCommandHandler(dbContext, groupAuthorizationService);
        var updatedPayload = $"{{\"eventId\":\"{eventId}\",\"applicantName\":\"Bob\"}}";

        var result = await handler.Handle(
            new EnrollGroupEventCommand(groupId, currentMemberId, eventId, updatedPayload),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        var enrollment = await dbContext.EventEnrollments.SingleAsync();
        Assert.Equal(enrollmentId, enrollment.Id);
        Assert.Equal(updatedPayload, enrollment.EnrollmentJson);
    }

    [Fact]
    public async Task EnrollGroupEvent_WhenPeopleCapacityWouldBeExceeded_ReturnsConflict()
    {
        using var dbContext = CreateInMemoryDbContext();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        var groupId = Guid.NewGuid();
        var currentMemberId = Guid.NewGuid();
        var existingMemberId = Guid.NewGuid();
        var eventId = Guid.NewGuid();
        dbContext.GroupEvents.Add(new GroupEvent
        {
            Id = eventId,
            GroupId = groupId,
            CreatedByMemberId = currentMemberId,
            TitleEn = "Camp",
            TitleZh = "营会",
            StartDate = DateTime.UtcNow.AddHours(2),
            EndDate = DateTime.UtcNow.AddHours(4),
            EventDataJson = $$"""{"registrationDeadline":"{{DateTime.UtcNow.AddHours(1):O}}","maxCapacity":4,"capacityUnit":"People"}""",
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow,
            RamAssessment = new EventRamAssessment
            {
                RamDataJson = "{}", Status = EventRamStatus.Approved,
                CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
            }
        });
        dbContext.EventEnrollments.Add(new EventEnrollment
        {
            Id = Guid.NewGuid(), GroupId = groupId, EventId = eventId, MemberId = existingMemberId,
            EnrollmentJson = "{\"applicantName\":\"Family A\",\"participantCount\":4}",
            CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
        });
        await dbContext.SaveChangesAsync();
        authorization.IsApprovedMemberAsync(groupId, currentMemberId, Arg.Any<CancellationToken>()).Returns(true);

        var result = await new EnrollGroupEventCommandHandler(dbContext, authorization).Handle(
            new EnrollGroupEventCommand(groupId, currentMemberId, eventId, "{\"applicantName\":\"Bob\",\"participantCount\":1}"),
            CancellationToken.None);

        Assert.Equal(Alife.Application.Common.Models.AppResultStatus.Conflict, result.Status);
        Assert.Single(await dbContext.EventEnrollments.ToListAsync());
    }
}
