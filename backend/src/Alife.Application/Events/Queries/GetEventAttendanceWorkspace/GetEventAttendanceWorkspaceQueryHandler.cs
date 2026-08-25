using System.Text.Json;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Queries.GetEventAttendanceWorkspace;

public sealed class GetEventAttendanceWorkspaceQueryHandler(IAlifeDbContext db, IGroupAuthorizationService authorization)
    : IRequestHandler<GetEventAttendanceWorkspaceQuery, AppResult<EventAttendanceWorkspaceDto>>
{
    public async Task<AppResult<EventAttendanceWorkspaceDto>> Handle(GetEventAttendanceWorkspaceQuery request, CancellationToken cancellationToken)
    {
        var groupEvent = await db.GroupEvents.AsNoTracking()
            .Include(x => x.Plan).ThenInclude(x => x!.Occurrences)
            .FirstOrDefaultAsync(x => x.Id == request.EventId, cancellationToken);
        if (groupEvent is null) return AppResult<EventAttendanceWorkspaceDto>.NotFound("Event not found.");
        if (!await authorization.IsLeaderOrCoLeaderAsync(groupEvent.GroupId, request.CurrentMemberId, cancellationToken))
            return AppResult<EventAttendanceWorkspaceDto>.Forbidden("Only event leaders can manage attendance.");

        EventRegistrationPolicy.TryReadSettings(groupEvent, out var settings, out _);
        var enrollments = await db.EventEnrollments.AsNoTracking()
            .Where(x => x.EventId == groupEvent.Id)
            .OrderBy(x => x.CreatedUtc)
            .Select(x => new { x.Id, x.EnrollmentJson })
            .ToListAsync(cancellationToken);
        var enrollmentDtos = enrollments.Select(x => new EventAttendanceEnrollmentDto(
            x.Id,
            ReadApplicantName(x.EnrollmentJson),
            EventRegistrationPolicy.TryReadReservedUnits(x.EnrollmentJson, settings.CapacityUnit, out var units, out _) ? units : 1))
            .ToArray();
        var records = await db.EventAttendanceRecords.AsNoTracking()
            .Where(x => x.EventId == groupEvent.Id)
            .OrderBy(x => x.UpdatedUtc)
            .Select(x => new EventAttendanceRecordDto(x.Id, x.EventOccurrenceId, x.EventEnrollmentId, x.AttendedUnits, x.Notes, x.UpdatedUtc))
            .ToArrayAsync(cancellationToken);
        var recordTotals = records.GroupBy(x => x.EventOccurrenceId).ToDictionary(x => x.Key, x => x.Sum(y => y.AttendedUnits));
        var now = DateTime.UtcNow;
        var occurrenceDtos = (groupEvent.Plan?.Occurrences ?? [])
            .OrderBy(x => x.SortOrder)
            .Select(x => new EventAttendanceOccurrenceDto(
                x.Id, new WorkflowTextDto(x.NameEn, x.NameZh), x.StartUtc, x.EndUtc, x.TimeZoneId,
                x.StartUtc <= now, recordTotals.GetValueOrDefault(x.Id)))
            .ToArray();

        return AppResult<EventAttendanceWorkspaceDto>.Success(new EventAttendanceWorkspaceDto(
            groupEvent.Id, groupEvent.GroupId, new WorkflowTextDto(groupEvent.TitleEn, groupEvent.TitleZh),
            settings.CapacityUnit, occurrenceDtos, enrollmentDtos, records,
            records.Sum(x => x.AttendedUnits), enrollmentDtos.Sum(x => x.ReservedUnits)));
    }

    private static string ReadApplicantName(string enrollmentJson)
    {
        try
        {
            using var document = JsonDocument.Parse(enrollmentJson);
            return document.RootElement.TryGetProperty("applicantName", out var value) && value.ValueKind == JsonValueKind.String
                ? value.GetString()?.Trim() ?? string.Empty
                : string.Empty;
        }
        catch (JsonException)
        {
            return string.Empty;
        }
    }
}
