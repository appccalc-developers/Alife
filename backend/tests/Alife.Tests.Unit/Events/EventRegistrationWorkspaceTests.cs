using Alife.Application.Events.Queries.GetEventRegistrationWorkspace;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.Events;

public sealed class EventRegistrationWorkspaceTests
{
    [Fact]
    public async Task Workspace_reports_people_capacity_without_exposing_raw_enrollment_payloads()
    {
        await using var db = CreateDbContext();
        var leaderId = Guid.NewGuid();
        var groupEvent = NewEvent(leaderId);
        db.GroupEvents.Add(groupEvent);
        db.EventEnrollments.AddRange(
            NewEnrollment(groupEvent, Guid.NewGuid(), "Alice", 3),
            NewEnrollment(groupEvent, Guid.NewGuid(), "Bob", 2));
        await db.SaveChangesAsync();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(groupEvent.GroupId, leaderId, Arg.Any<CancellationToken>()).Returns(true);

        var result = await new GetEventRegistrationWorkspaceQueryHandler(db, authorization).Handle(
            new GetEventRegistrationWorkspaceQuery(groupEvent.Id, leaderId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal("open", result.Value!.Status);
        Assert.Equal(5, result.Value.ReservedUnits);
        Assert.Equal(5, result.Value.RemainingUnits);
        Assert.Equal(["Alice", "Bob"], result.Value.Registrations.Select(x => x.ApplicantName).Order().ToArray());
    }

    [Fact]
    public async Task Workspace_requires_event_leader_permission()
    {
        await using var db = CreateDbContext();
        var groupEvent = NewEvent(Guid.NewGuid());
        db.GroupEvents.Add(groupEvent);
        await db.SaveChangesAsync();
        var authorization = Substitute.For<IGroupAuthorizationService>();

        var result = await new GetEventRegistrationWorkspaceQueryHandler(db, authorization).Handle(
            new GetEventRegistrationWorkspaceQuery(groupEvent.Id, Guid.NewGuid()), CancellationToken.None);

        Assert.Equal(Alife.Application.Common.Models.AppResultStatus.Forbidden, result.Status);
    }

    [Fact]
    public async Task Workspace_is_unavailable_when_registration_is_not_in_the_event_plan()
    {
        await using var db = CreateDbContext();
        var leaderId = Guid.NewGuid();
        var groupEvent = NewEvent(leaderId);
        groupEvent.EventDataJson = "{}";
        db.GroupEvents.Add(groupEvent);
        await db.SaveChangesAsync();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(groupEvent.GroupId, leaderId, Arg.Any<CancellationToken>()).Returns(true);

        var result = await new GetEventRegistrationWorkspaceQueryHandler(db, authorization).Handle(
            new GetEventRegistrationWorkspaceQuery(groupEvent.Id, leaderId), CancellationToken.None);

        Assert.Equal(Alife.Application.Common.Models.AppResultStatus.Conflict, result.Status);
    }

    private static GroupEvent NewEvent(Guid leaderId)
    {
        var now = DateTime.UtcNow;
        return new GroupEvent
        {
            Id = Guid.NewGuid(), GroupId = Guid.NewGuid(), CreatedByMemberId = leaderId,
            TitleEn = "Community day", TitleZh = "社区活动",
            StartDate = now.AddDays(2), EndDate = now.AddDays(2).AddHours(2),
            EventDataJson = $$"""{"visibility":"groupVisible","registrationDeadline":"{{now.AddDays(1):O}}","maxCapacity":10,"capacityUnit":"People"}""",
            CreatedUtc = now, UpdatedUtc = now
        };
    }

    private static EventEnrollment NewEnrollment(GroupEvent groupEvent, Guid memberId, string name, int participants)
        => new()
        {
            Id = Guid.NewGuid(), GroupId = groupEvent.GroupId, EventId = groupEvent.Id, MemberId = memberId,
            EnrollmentJson = $$"""{"applicantName":"{{name}}","participantCount":{{participants}},"privateNote":"not projected"}""",
            CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
        };

    private static AlifeDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AlifeDbContext(options);
    }
}
