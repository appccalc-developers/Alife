using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Queries.GetEventClosureWorkspace;

public sealed class GetEventClosureWorkspaceQueryHandler(IAlifeDbContext db, IGroupAuthorizationService authorization)
    : IRequestHandler<GetEventClosureWorkspaceQuery, AppResult<EventClosureWorkspaceDto>>
{
    public async Task<AppResult<EventClosureWorkspaceDto>> Handle(GetEventClosureWorkspaceQuery request, CancellationToken cancellationToken)
    {
        var groupEvent = await db.GroupEvents.AsNoTracking()
            .Include(x => x.ClosureReport).ThenInclude(x => x!.ConfirmedByMember)
            .FirstOrDefaultAsync(x => x.Id == request.EventId, cancellationToken);
        if (groupEvent is null) return AppResult<EventClosureWorkspaceDto>.NotFound("Event not found.");
        if (!await authorization.IsLeaderOrCoLeaderAsync(groupEvent.GroupId, request.CurrentMemberId, cancellationToken))
            return AppResult<EventClosureWorkspaceDto>.Forbidden("Only event leaders can manage the closure report.");

        var enrollmentCount = await db.EventEnrollments.AsNoTracking().CountAsync(x => x.EventId == groupEvent.Id, cancellationToken);
        var rosterCounts = await db.EventRosterShifts.AsNoTracking().Where(x => x.EventId == groupEvent.Id)
            .Select(x => new
            {
                x.RequiredPeople,
                Accepted = x.Assignments.Count(a => a.Status == EventRosterAssignmentStatus.Accepted)
            }).ToListAsync(cancellationToken);
        var reviewCount = await db.EventReviews.AsNoTracking().CountAsync(x => x.EventId == groupEvent.Id, cancellationToken);
        var attendanceUnits = await db.EventAttendanceRecords.AsNoTracking()
            .Where(x => x.EventId == groupEvent.Id).SumAsync(x => (int?)x.AttendedUnits, cancellationToken) ?? 0;
        var attendanceRecorded = await db.EventAttendanceRecords.AsNoTracking()
            .AnyAsync(x => x.EventId == groupEvent.Id, cancellationToken);
        var financeTotals = await db.EventFinanceEntries.AsNoTracking().Where(x => x.EventId == groupEvent.Id)
            .GroupBy(_ => 1)
            .Select(x => new
            {
                Income = x.Where(y => y.Type == EventFinanceEntryType.Income).Sum(y => y.Amount),
                Expense = x.Where(y => y.Type == EventFinanceEntryType.Expense).Sum(y => y.Amount)
            }).FirstOrDefaultAsync(cancellationToken);
        var financeReconciled = await db.EventFinanceReconciliations.AsNoTracking()
            .AnyAsync(x => x.EventId == groupEvent.Id && x.LeaderConfirmed, cancellationToken);

        var previousReports = await db.EventClosureReports.AsNoTracking()
            .Include(x => x.Event)
            .Where(x => x.Event.GroupId == groupEvent.GroupId && x.EventId != groupEvent.Id
                && x.LeaderConfirmed && x.Event.EndDate < groupEvent.StartDate)
            .OrderByDescending(x => x.Event.EndDate)
            .Take(10)
            .ToListAsync(cancellationToken);
        var previousLearnings = previousReports.SelectMany(report =>
            EventClosureLearningSerializer.Read(report.ReusableLearningsJson)
                .Where(x => x.ReuseNextTime)
                .Select(learning => new EventClosureSourceLearningDto(
                    report.EventId, new WorkflowTextDto(report.Event.TitleEn, report.Event.TitleZh),
                    report.Event.EndDate, learning)))
            .Take(30)
            .ToArray();

        var closure = groupEvent.ClosureReport;
        var reportDto = closure is null
            ? new EventClosureReportDto(new WorkflowTextDto(string.Empty, string.Empty), string.Empty, string.Empty,
                string.Empty, string.Empty, [], false, null, null, null, null)
            : new EventClosureReportDto(
                new WorkflowTextDto(closure.SummaryEn, closure.SummaryZh), closure.AttendanceNotes,
                closure.FinanceNotes, closure.IncidentNotes, closure.FollowUpNotes,
                EventClosureLearningSerializer.Read(closure.ReusableLearningsJson), closure.LeaderConfirmed,
                closure.ConfirmedByMemberId, closure.ConfirmedByMember?.DisplayName,
                closure.ConfirmedUtc, closure.UpdatedUtc);
        return AppResult<EventClosureWorkspaceDto>.Success(new EventClosureWorkspaceDto(
            groupEvent.Id, groupEvent.GroupId, new WorkflowTextDto(groupEvent.TitleEn, groupEvent.TitleZh),
            groupEvent.EndDate, groupEvent.EndDate <= DateTime.UtcNow,
            new EventClosureEvidenceDto(
                enrollmentCount, rosterCounts.Sum(x => x.Accepted), rosterCounts.Sum(x => x.RequiredPeople), reviewCount,
                attendanceUnits, attendanceRecorded, financeTotals?.Income ?? 0, financeTotals?.Expense ?? 0, financeReconciled),
            reportDto, previousLearnings));
    }
}
