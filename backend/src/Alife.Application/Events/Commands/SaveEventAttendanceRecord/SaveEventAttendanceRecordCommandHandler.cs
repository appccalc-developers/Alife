using System.Text.Json;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Commands.SaveEventAttendanceRecord;

public sealed class SaveEventAttendanceRecordCommandHandler(IAlifeDbContext db, IGroupAuthorizationService authorization)
    : IRequestHandler<SaveEventAttendanceRecordCommand, AppResult<EventAttendanceRecordDto>>
{
    public async Task<AppResult<EventAttendanceRecordDto>> Handle(SaveEventAttendanceRecordCommand request, CancellationToken cancellationToken)
    {
        if (request.AttendedUnits < 0 || request.AttendedUnits > 10000)
            return AppResult<EventAttendanceRecordDto>.Validation("Attended units must be between 0 and 10,000.");
        if (request.Notes.Length > 1000)
            return AppResult<EventAttendanceRecordDto>.Validation("Attendance notes cannot exceed 1,000 characters.");

        var groupEvent = await db.GroupEvents
            .Include(x => x.ClosureReport)
            .FirstOrDefaultAsync(x => x.Id == request.EventId, cancellationToken);
        if (groupEvent is null) return AppResult<EventAttendanceRecordDto>.NotFound("Event not found.");
        if (!await authorization.IsLeaderOrCoLeaderAsync(groupEvent.GroupId, request.CurrentMemberId, cancellationToken))
            return AppResult<EventAttendanceRecordDto>.Forbidden("Only event leaders can record attendance.");

        var occurrence = await db.EventOccurrences.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == request.EventOccurrenceId && x.EventPlan.EventId == groupEvent.Id, cancellationToken);
        if (occurrence is null) return AppResult<EventAttendanceRecordDto>.Validation("The selected session does not belong to this event.");
        if (occurrence.StartUtc > DateTime.UtcNow)
            return AppResult<EventAttendanceRecordDto>.Validation("Attendance can be recorded only after the session has started.");
        if (request.EventEnrollmentId is Guid enrollmentId && !await db.EventEnrollments.AsNoTracking()
                .AnyAsync(x => x.Id == enrollmentId && x.EventId == groupEvent.Id, cancellationToken))
            return AppResult<EventAttendanceRecordDto>.Validation("The selected registration does not belong to this event.");

        var record = await db.EventAttendanceRecords.FirstOrDefaultAsync(
            x => x.EventOccurrenceId == occurrence.Id && x.EventEnrollmentId == request.EventEnrollmentId, cancellationToken);
        var now = DateTime.UtcNow;
        var before = record is null ? null : JsonSerializer.Serialize(new { record.AttendedUnits, record.Notes });
        if (record is null)
        {
            record = new EventAttendanceRecord
            {
                Id = Guid.NewGuid(), EventId = groupEvent.Id, EventOccurrenceId = occurrence.Id,
                EventEnrollmentId = request.EventEnrollmentId, CreatedUtc = now
            };
            db.EventAttendanceRecords.Add(record);
        }
        record.AttendedUnits = request.AttendedUnits;
        record.Notes = request.Notes.Trim();
        record.RecordedByMemberId = request.CurrentMemberId;
        record.UpdatedUtc = now;
        InvalidateClosure(groupEvent);
        db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(), ActorMemberId = request.CurrentMemberId, Action = "event.attendance.recorded",
            EntityType = nameof(EventAttendanceRecord), EntityId = record.Id, GroupId = groupEvent.GroupId, EventId = groupEvent.Id,
            BeforeJson = before, AfterJson = JsonSerializer.Serialize(new { record.EventOccurrenceId, record.EventEnrollmentId, record.AttendedUnits }),
            OccurredUtc = now
        });
        await db.SaveChangesAsync(cancellationToken);
        return AppResult<EventAttendanceRecordDto>.Success(new EventAttendanceRecordDto(
            record.Id, record.EventOccurrenceId, record.EventEnrollmentId, record.AttendedUnits, record.Notes, record.UpdatedUtc));
    }

    private static void InvalidateClosure(GroupEvent groupEvent)
    {
        if (groupEvent.ClosureReport is null) return;
        groupEvent.ClosureReport.LeaderConfirmed = false;
        groupEvent.ClosureReport.ConfirmedByMemberId = null;
        groupEvent.ClosureReport.ConfirmedUtc = null;
        groupEvent.ClosureReport.UpdatedUtc = DateTime.UtcNow;
    }
}
