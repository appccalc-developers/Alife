using System.Text.Json;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Commands.UpdateEventClosureReport;

public sealed class UpdateEventClosureReportCommandHandler(IAlifeDbContext db, IGroupAuthorizationService authorization)
    : IRequestHandler<UpdateEventClosureReportCommand, AppResult<EventClosureReportDto>>
{
    public async Task<AppResult<EventClosureReportDto>> Handle(UpdateEventClosureReportCommand request, CancellationToken cancellationToken)
    {
        var groupEvent = await db.GroupEvents
            .Include(x => x.ClosureReport).ThenInclude(x => x!.ConfirmedByMember)
            .Include(x => x.Plan).ThenInclude(x => x!.Modules)
            .FirstOrDefaultAsync(x => x.Id == request.EventId, cancellationToken);
        if (groupEvent is null) return AppResult<EventClosureReportDto>.NotFound("Event not found.");
        if (!await authorization.IsLeaderOrCoLeaderAsync(groupEvent.GroupId, request.CurrentMemberId, cancellationToken))
            return AppResult<EventClosureReportDto>.Forbidden("Only event leaders can update the closure report.");
        if (groupEvent.EndDate > DateTime.UtcNow)
            return AppResult<EventClosureReportDto>.Validation("The closure report can be finalized only after the event has ended.");

        var now = DateTime.UtcNow;
        var summaryEn = Trim(request.SummaryEn, 4000);
        var summaryZh = Trim(request.SummaryZh, 4000);
        var attendanceNotes = Trim(request.AttendanceNotes, 4000);
        var financeNotes = Trim(request.FinanceNotes, 4000);
        var incidentNotes = Trim(request.IncidentNotes, 4000);
        var followUpNotes = Trim(request.FollowUpNotes, 4000);
        var learnings = EventClosureLearningSerializer.Normalize(request.Learnings);
        var candidate = new EventClosureReport
        {
            SummaryEn = summaryEn,
            SummaryZh = summaryZh,
            AttendanceNotes = attendanceNotes,
            FinanceNotes = financeNotes,
            IncidentNotes = incidentNotes,
            FollowUpNotes = followUpNotes
        };
        if (request.LeaderConfirmed && !EventClosurePolicy.IsComplete(candidate))
            return AppResult<EventClosureReportDto>.Validation("Complete the bilingual summary, attendance, finance, incident and follow-up sections before confirming closure.");
        if (request.LeaderConfirmed)
        {
            var hasEnrollments = await db.EventEnrollments.AsNoTracking().AnyAsync(x => x.EventId == groupEvent.Id, cancellationToken);
            var hasAttendance = await db.EventAttendanceRecords.AsNoTracking().AnyAsync(x => x.EventId == groupEvent.Id, cancellationToken);
            if (hasEnrollments && !hasAttendance)
                return AppResult<EventClosureReportDto>.Validation("Record the actual attendance before confirming closure.");
            var hasFinanceEntries = await db.EventFinanceEntries.AsNoTracking().AnyAsync(x => x.EventId == groupEvent.Id, cancellationToken);
            var financeModuleSelected = groupEvent.Plan?.Modules.Any(x => x.ModuleKey == "finance" && x.IsRequired) == true;
            var financeReconciled = await db.EventFinanceReconciliations.AsNoTracking()
                .AnyAsync(x => x.EventId == groupEvent.Id && x.LeaderConfirmed, cancellationToken);
            if ((financeModuleSelected || hasFinanceEntries) && !financeReconciled)
                return AppResult<EventClosureReportDto>.Validation("Reconcile the actual income and expenses before confirming closure.");
        }

        var report = groupEvent.ClosureReport ?? new EventClosureReport
        {
            EventId = groupEvent.Id,
            CreatedUtc = now
        };
        if (groupEvent.ClosureReport is null)
        {
            groupEvent.ClosureReport = report;
            db.EventClosureReports.Add(report);
        }
        report.SummaryEn = summaryEn;
        report.SummaryZh = summaryZh;
        report.AttendanceNotes = attendanceNotes;
        report.FinanceNotes = financeNotes;
        report.IncidentNotes = incidentNotes;
        report.FollowUpNotes = followUpNotes;
        report.ReusableLearningsJson = EventClosureLearningSerializer.Write(learnings);
        report.UpdatedUtc = now;
        report.LeaderConfirmed = request.LeaderConfirmed;
        report.ConfirmedByMemberId = request.LeaderConfirmed ? request.CurrentMemberId : null;
        report.ConfirmedUtc = request.LeaderConfirmed ? now : null;
        db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(), ActorMemberId = request.CurrentMemberId, GroupId = groupEvent.GroupId, EventId = groupEvent.Id,
            Action = request.LeaderConfirmed ? "event.closure.confirmed" : "event.closure.draft-saved",
            EntityType = "eventClosureReport", EntityId = groupEvent.Id,
            AfterJson = JsonSerializer.Serialize(new { report.LeaderConfirmed, reusableLearningCount = learnings.Count(x => x.ReuseNextTime) }),
            OccurredUtc = now
        });
        await db.SaveChangesAsync(cancellationToken);
        report.ConfirmedByMember ??= request.LeaderConfirmed
            ? await db.Members.AsNoTracking().FirstOrDefaultAsync(x => x.Id == request.CurrentMemberId, cancellationToken)
            : null;
        return AppResult<EventClosureReportDto>.Success(new EventClosureReportDto(
            new WorkflowTextDto(report.SummaryEn, report.SummaryZh), report.AttendanceNotes, report.FinanceNotes,
            report.IncidentNotes, report.FollowUpNotes, learnings, report.LeaderConfirmed,
            report.ConfirmedByMemberId, report.ConfirmedByMember?.DisplayName, report.ConfirmedUtc, report.UpdatedUtc));
    }

    private static string Trim(string? value, int max)
    {
        var normalized = value?.Trim() ?? string.Empty;
        return normalized[..Math.Min(normalized.Length, max)];
    }
}
