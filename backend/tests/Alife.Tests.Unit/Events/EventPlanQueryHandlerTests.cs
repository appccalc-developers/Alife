using Alife.Application.Events.Queries.GetEventPlan;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.Events;

public sealed class EventPlanQueryHandlerTests
{
    [Fact]
    public async Task Plan_projects_real_venue_and_ram_approval_into_module_readiness()
    {
        await using var db = CreateDbContext();
        var leaderId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        var groupEvent = new GroupEvent
        {
            Id = Guid.NewGuid(), GroupId = Guid.NewGuid(), CreatedByMemberId = leaderId,
            TitleEn = "Community day", TitleZh = "社区活动",
            StartDate = now.AddDays(5), EndDate = now.AddDays(5).AddHours(3),
            EventDataJson = """{"enabledModules":["venue","ram"],"description":{"en":"A community day","zh":"社区活动"},"locationName":{"en":"Church hall","zh":"教会礼堂"},"hardConstraints":[{"key":"children"}]}""",
            CreatedUtc = now, UpdatedUtc = now
        };
        groupEvent.RamAssessment = new EventRamAssessment
        {
            EventId = groupEvent.Id, RamDataJson = "{\"risks\":[{}]}", Status = EventRamStatus.Approved,
            CreatedUtc = now, UpdatedUtc = now, ApprovedByMemberId = leaderId, ApprovedUtc = now
        };
        groupEvent.Plan = EventCompositionFactory.CreateInitial(groupEvent, leaderId, groupEvent.RamAssessment.RamDataJson, now);
        groupEvent.VenueBookings.Add(new EventVenueBooking
        {
            Id = Guid.NewGuid(), EventId = groupEvent.Id, VenueSpaceId = Guid.NewGuid(), RequestedByMemberId = leaderId,
            PurposeEn = "Community day", PurposeZh = "社区活动", StartUtc = groupEvent.StartDate, EndUtc = groupEvent.EndDate,
            AttendeeCount = 50, Status = VenueBookingStatus.Approved, CreatedUtc = now, UpdatedUtc = now
        });
        db.GroupEvents.Add(groupEvent);
        await db.SaveChangesAsync();

        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(groupEvent.GroupId, leaderId, Arg.Any<CancellationToken>()).Returns(true);
        var result = await new GetEventPlanQueryHandler(db, authorization)
            .Handle(new GetEventPlanQuery(groupEvent.Id, leaderId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(EventPlanStatus.Ready, result.Value!.Status);
        Assert.Equal(EventModuleStatus.Ready, result.Value.Modules.Single(x => x.Key == "venue").Status);
        Assert.Equal(EventModuleStatus.Ready, result.Value.Modules.Single(x => x.Key == "ram").Status);
        Assert.All(result.Value.ReadinessGates.Where(x => x.IsRequired), x => Assert.Equal(EventReadinessStatus.Satisfied, x.Status));
        Assert.Equal("approved", result.Value.Approvals.Single(x => x.Key == "venue.booking.approval").Status);
        Assert.Equal("approved", result.Value.Approvals.Single(x => x.Key == EventRamDecisionPolicy.DecisionKey).Status);
        var communicationsModule = result.Value.Modules.Single(x => x.Key == "communications");
        Assert.Equal("确认活动通知", result.Value.ReadinessGates.Single(x => x.ModuleInstanceId == communicationsModule.Id).Name.Zh);
        Assert.Equal("ready", result.Value.Milestones.Single(x => x.Key == "announce").Status);
        Assert.Equal("notApplicable", result.Value.Milestones.Single(x => x.Key == "register").Status);
        Assert.Equal("ready", result.Value.Milestones.Single(x => x.Key == "run").Status);
        Assert.Equal("pending", result.Value.Milestones.Single(x => x.Key == "close").Status);
    }

    [Fact]
    public async Task Plan_keeps_submitted_human_approvals_in_progress()
    {
        await using var db = CreateDbContext();
        var leaderId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        var groupEvent = new GroupEvent
        {
            Id = Guid.NewGuid(), GroupId = Guid.NewGuid(), CreatedByMemberId = leaderId,
            TitleEn = "Community day", TitleZh = "社区活动",
            StartDate = now.AddDays(5), EndDate = now.AddDays(5).AddHours(3),
            EventDataJson = """{"enabledModules":["venue","ram"],"description":{"en":"A community day"},"locationName":{"en":"Church hall"},"hardConstraints":[{"key":"children"}]}""",
            CreatedUtc = now, UpdatedUtc = now
        };
        groupEvent.RamAssessment = new EventRamAssessment
        {
            EventId = groupEvent.Id, RamDataJson = "{\"risks\":[{}]}", Status = EventRamStatus.AwaitingReview,
            CreatedUtc = now, UpdatedUtc = now, SubmittedByMemberId = leaderId, SubmittedUtc = now
        };
        groupEvent.Plan = EventCompositionFactory.CreateInitial(groupEvent, leaderId, groupEvent.RamAssessment.RamDataJson, now);
        groupEvent.VenueBookings.Add(new EventVenueBooking
        {
            Id = Guid.NewGuid(), EventId = groupEvent.Id, VenueSpaceId = Guid.NewGuid(), RequestedByMemberId = leaderId,
            PurposeEn = "Community day", PurposeZh = "社区活动", StartUtc = groupEvent.StartDate, EndUtc = groupEvent.EndDate,
            AttendeeCount = 50, Status = VenueBookingStatus.Submitted, CreatedUtc = now, UpdatedUtc = now
        });
        db.GroupEvents.Add(groupEvent);
        await db.SaveChangesAsync();

        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(groupEvent.GroupId, leaderId, Arg.Any<CancellationToken>()).Returns(true);
        var result = await new GetEventPlanQueryHandler(db, authorization)
            .Handle(new GetEventPlanQuery(groupEvent.Id, leaderId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(EventPlanStatus.Active, result.Value!.Status);
        Assert.Equal(EventModuleStatus.Configuring, result.Value.Modules.Single(x => x.Key == "venue").Status);
        Assert.Equal(EventModuleStatus.Configuring, result.Value.Modules.Single(x => x.Key == "ram").Status);
        Assert.Equal("requested", result.Value.Approvals.Single(x => x.Key == "venue.booking.approval").Status);
        Assert.Equal("requested", result.Value.Approvals.Single(x => x.Key == EventRamDecisionPolicy.DecisionKey).Status);
        Assert.Equal("pending", result.Value.Milestones.Single(x => x.Key == "announce").Status);
        Assert.Equal("pending", result.Value.Milestones.Single(x => x.Key == "run").Status);
    }

    [Fact]
    public async Task Venue_readiness_requires_every_active_request_to_be_approved()
    {
        await using var db = CreateDbContext();
        var leaderId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        var groupEvent = new GroupEvent
        {
            Id = Guid.NewGuid(), GroupId = Guid.NewGuid(), CreatedByMemberId = leaderId,
            TitleEn = "Multi-session event", TitleZh = "多场次活动",
            StartDate = now.AddDays(5), EndDate = now.AddDays(5).AddHours(5),
            EventDataJson = """{"enabledModules":["venue"],"description":{"en":"Two sessions"},"locationName":{"en":"Church"}}""",
            CreatedUtc = now, UpdatedUtc = now
        };
        groupEvent.Plan = EventCompositionFactory.CreateInitial(groupEvent, leaderId, null, now);
        groupEvent.VenueBookings.Add(new EventVenueBooking
        {
            Id = Guid.NewGuid(), EventId = groupEvent.Id, VenueSpaceId = Guid.NewGuid(), RequestedByMemberId = leaderId,
            PurposeEn = "Morning session", PurposeZh = "上午场", StartUtc = groupEvent.StartDate,
            EndUtc = groupEvent.StartDate.AddHours(2), AttendeeCount = 30, Status = VenueBookingStatus.Draft,
            CreatedUtc = now.AddMinutes(-2), UpdatedUtc = now.AddMinutes(-2)
        });
        groupEvent.VenueBookings.Add(new EventVenueBooking
        {
            Id = Guid.NewGuid(), EventId = groupEvent.Id, VenueSpaceId = Guid.NewGuid(), RequestedByMemberId = leaderId,
            PurposeEn = "Afternoon session", PurposeZh = "下午场", StartUtc = groupEvent.StartDate.AddHours(3),
            EndUtc = groupEvent.EndDate, AttendeeCount = 30, Status = VenueBookingStatus.Approved,
            CreatedUtc = now, UpdatedUtc = now
        });
        db.GroupEvents.Add(groupEvent);
        await db.SaveChangesAsync();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(groupEvent.GroupId, leaderId, Arg.Any<CancellationToken>()).Returns(true);

        var result = await new GetEventPlanQueryHandler(db, authorization)
            .Handle(new GetEventPlanQuery(groupEvent.Id, leaderId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(EventModuleStatus.Configuring, result.Value!.Modules.Single(x => x.Key == "venue").Status);
        Assert.Equal("pending", result.Value.Milestones.Single(x => x.Key == "run").Status);
    }

    [Fact]
    public async Task Plan_marks_invalid_registration_configuration_as_blocked_and_reports_capacity()
    {
        await using var db = CreateDbContext();
        var leaderId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        var groupEvent = new GroupEvent
        {
            Id = Guid.NewGuid(), GroupId = Guid.NewGuid(), CreatedByMemberId = leaderId,
            TitleEn = "Community day", TitleZh = "社区活动",
            StartDate = now.AddDays(2), EndDate = now.AddDays(2).AddHours(3),
            EventDataJson = $$"""{"description":{"en":"Day","zh":"活动"},"maxCapacity":5,"capacityUnit":"People","registrationDeadline":"{{now.AddDays(3):O}}"}""",
            CreatedUtc = now, UpdatedUtc = now
        };
        groupEvent.Plan = EventCompositionFactory.CreateInitial(groupEvent, leaderId, null, now);
        db.GroupEvents.Add(groupEvent);
        db.EventEnrollments.Add(new EventEnrollment
        {
            Id = Guid.NewGuid(), GroupId = groupEvent.GroupId, EventId = groupEvent.Id, MemberId = Guid.NewGuid(),
            EnrollmentJson = "{\"participantCount\":2}", CreatedUtc = now, UpdatedUtc = now
        });
        await db.SaveChangesAsync();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(groupEvent.GroupId, leaderId, Arg.Any<CancellationToken>()).Returns(true);

        var result = await new GetEventPlanQueryHandler(db, authorization).Handle(
            new GetEventPlanQuery(groupEvent.Id, leaderId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(EventModuleStatus.Blocked, result.Value!.Modules.Single(x => x.Key == "registration").Status);
        Assert.Equal("invalid", result.Value.Registration!.State);
        Assert.Equal(2, result.Value.Registration.ReservedUnits);
        Assert.Equal(3, result.Value.Registration.RemainingUnits);
        var registrationMilestone = result.Value.Milestones.Single(x => x.Key == "register");
        Assert.Equal("blocked", registrationMilestone.Status);
        Assert.Equal("blocked", registrationMilestone.Checks.Single(x => x.Key == "registration").Status);
    }

    [Fact]
    public async Task Plan_explains_task_owner_deadline_and_dependency_readiness()
    {
        await using var db = CreateDbContext();
        var leaderId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        var groupEvent = new GroupEvent
        {
            Id = Guid.NewGuid(), GroupId = Guid.NewGuid(), CreatedByMemberId = leaderId,
            TitleEn = "Community day", TitleZh = "社区活动",
            StartDate = now.AddDays(5), EndDate = now.AddDays(5).AddHours(3),
            EventDataJson = """{"description":{"en":"Day","zh":"活动"},"locationName":{"en":"Hall","zh":"礼堂"}}""",
            CreatedUtc = now, UpdatedUtc = now
        };
        groupEvent.Plan = EventCompositionFactory.CreateInitial(groupEvent, leaderId, null, now);
        groupEvent.PreparationTasks.Add(new EventPreparationTask
        {
            Id = Guid.NewGuid(), EventId = groupEvent.Id, Event = groupEvent, ModuleKey = "general",
            TitleEn = "Prepare welcome desk", TitleZh = "准备接待台", IsRequired = true,
            Status = EventPreparationTaskStatus.Todo, CreatedByMemberId = leaderId, UpdatedByMemberId = leaderId,
            CreatedUtc = now, UpdatedUtc = now
        });
        EventPreparationPlanSync.Apply(groupEvent.Plan, groupEvent.PreparationTasks, groupEvent.StartDate, leaderId, now);
        db.GroupEvents.Add(groupEvent);
        await db.SaveChangesAsync();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(groupEvent.GroupId, leaderId, Arg.Any<CancellationToken>()).Returns(true);

        var result = await new GetEventPlanQueryHandler(db, authorization).Handle(
            new GetEventPlanQuery(groupEvent.Id, leaderId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(EventModuleStatus.Blocked, result.Value!.Modules.Single(x => x.Key == EventPreparationPlanSync.ModuleKey).Status);
        Assert.NotNull(result.Value.PreparationTasks);
        Assert.Equal(1, result.Value.PreparationTasks.RequiredCount);
        Assert.Equal(1, result.Value.PreparationTasks.UnassignedCount);
        Assert.Equal(1, result.Value.PreparationTasks.MissingDueDateCount);
        Assert.Single(result.Value.PreparationTasks.NextTasks);
        var run = result.Value.Milestones.Single(x => x.Key == "run");
        Assert.Equal("blocked", run.Status);
        Assert.Equal("blocked", run.Checks.Single(x => x.Key == "taskOwners").Status);
        Assert.Equal("blocked", run.Checks.Single(x => x.Key == "taskDueDates").Status);
        Assert.Equal("pending", run.Checks.Single(x => x.Key == "tasks").Status);
    }

    private static AlifeDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AlifeDbContext(options);
    }
}
