using Alife.Application.Common.Models;
using Alife.Application.Events.Commands.SaveEventAttendanceRecord;
using Alife.Application.Events.Queries.GetEventAttendanceWorkspace;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.Events;

public sealed class EventAttendanceWorkflowTests
{
    [Fact]
    public async Task Attendance_workspace_rejects_non_leaders()
    {
        await using var db = CreateDbContext();
        var (groupEvent, _) = EventWithOccurrence(DateTime.UtcNow.AddHours(-2));
        db.GroupEvents.Add(groupEvent);
        await db.SaveChangesAsync();
        var authorization = Substitute.For<IGroupAuthorizationService>();

        var result = await new GetEventAttendanceWorkspaceQueryHandler(db, authorization).Handle(
            new GetEventAttendanceWorkspaceQuery(groupEvent.Id, Guid.NewGuid()), CancellationToken.None);

        Assert.Equal(AppResultStatus.Forbidden, result.Status);
    }

    [Fact]
    public async Task Attendance_cannot_be_recorded_before_the_session_starts()
    {
        await using var db = CreateDbContext();
        var leaderId = Guid.NewGuid();
        var (groupEvent, occurrence) = EventWithOccurrence(DateTime.UtcNow.AddHours(1), leaderId);
        db.GroupEvents.Add(groupEvent);
        await db.SaveChangesAsync();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(groupEvent.GroupId, leaderId, Arg.Any<CancellationToken>()).Returns(true);

        var result = await new SaveEventAttendanceRecordCommandHandler(db, authorization).Handle(
            new SaveEventAttendanceRecordCommand(groupEvent.Id, leaderId, occurrence.Id, null, 3, "Early"),
            CancellationToken.None);

        Assert.Equal(AppResultStatus.ValidationError, result.Status);
        Assert.Empty(await db.EventAttendanceRecords.ToListAsync());
    }

    [Fact]
    public async Task Saving_actual_attendance_is_audited_and_invalidates_existing_closure_confirmation()
    {
        await using var db = CreateDbContext();
        var leaderId = Guid.NewGuid();
        var (groupEvent, occurrence) = EventWithOccurrence(DateTime.UtcNow.AddHours(-2), leaderId);
        groupEvent.ClosureReport = new EventClosureReport
        {
            EventId = groupEvent.Id, SummaryEn = "Summary", SummaryZh = "总结",
            AttendanceNotes = "Ten", FinanceNotes = "None", IncidentNotes = "None", FollowUpNotes = "Done",
            LeaderConfirmed = true, ConfirmedByMemberId = leaderId, ConfirmedUtc = DateTime.UtcNow.AddMinutes(-10),
            CreatedUtc = DateTime.UtcNow.AddHours(-1), UpdatedUtc = DateTime.UtcNow.AddMinutes(-10)
        };
        db.GroupEvents.Add(groupEvent);
        await db.SaveChangesAsync();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(groupEvent.GroupId, leaderId, Arg.Any<CancellationToken>()).Returns(true);

        var result = await new SaveEventAttendanceRecordCommandHandler(db, authorization).Handle(
            new SaveEventAttendanceRecordCommand(groupEvent.Id, leaderId, occurrence.Id, null, 4, "Walk-ins"),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(4, result.Value!.AttendedUnits);
        Assert.False(groupEvent.ClosureReport.LeaderConfirmed);
        Assert.Null(groupEvent.ClosureReport.ConfirmedByMemberId);
        Assert.Contains(await db.AuditLogs.ToListAsync(), x => x.Action == "event.attendance.recorded");
    }

    private static (GroupEvent Event, EventOccurrence Occurrence) EventWithOccurrence(DateTime startUtc, Guid? leaderId = null)
    {
        var actorId = leaderId ?? Guid.NewGuid();
        var groupEvent = new GroupEvent
        {
            Id = Guid.NewGuid(), GroupId = Guid.NewGuid(), CreatedByMemberId = actorId,
            TitleEn = "Event", TitleZh = "活动", StartDate = startUtc, EndDate = startUtc.AddHours(1),
            EventDataJson = """{"enabledModules":[],"description":{"en":"Event","zh":"活动"}}""",
            CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
        };
        var plan = new EventPlan
        {
            Id = Guid.NewGuid(), EventId = groupEvent.Id, CurrentRevision = 1, Status = EventPlanStatus.Active,
            CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
        };
        var occurrence = new EventOccurrence
        {
            Id = Guid.NewGuid(), EventPlanId = plan.Id, OccurrenceKey = "main", NameEn = "Main", NameZh = "主场次",
            StartUtc = startUtc, EndUtc = startUtc.AddHours(1), TimeZoneId = "UTC", SortOrder = 0
        };
        plan.Occurrences.Add(occurrence);
        groupEvent.Plan = plan;
        return (groupEvent, occurrence);
    }

    private static AlifeDbContext CreateDbContext() => new(new DbContextOptionsBuilder<AlifeDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
}
