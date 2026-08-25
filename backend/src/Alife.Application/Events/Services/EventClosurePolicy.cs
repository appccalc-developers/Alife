using Alife.Domain.Entities;
using Alife.Domain.Enums;

namespace Alife.Application.Events.Services;

public static class EventClosurePolicy
{
    public static EventModuleStatus ModuleStatus(GroupEvent groupEvent)
    {
        var report = groupEvent.ClosureReport;
        if (report is null) return EventModuleStatus.NotConfigured;
        if (!IsComplete(report)) return report.LeaderConfirmed ? EventModuleStatus.Blocked : EventModuleStatus.Configuring;
        return report.LeaderConfirmed ? EventModuleStatus.Ready : EventModuleStatus.Configuring;
    }

    public static bool IsComplete(EventClosureReport report) =>
        HasText(report.SummaryEn) && HasText(report.SummaryZh)
        && HasText(report.AttendanceNotes) && HasText(report.FinanceNotes)
        && HasText(report.IncidentNotes) && HasText(report.FollowUpNotes);

    public static bool ScheduleChanged(GroupEvent groupEvent, DateTime nextStart, DateTime nextEnd) =>
        groupEvent.StartDate != nextStart || groupEvent.EndDate != nextEnd;

    private static bool HasText(string? value) => !string.IsNullOrWhiteSpace(value);
}
