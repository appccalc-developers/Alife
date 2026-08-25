using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using MediatR;

namespace Alife.Application.Events.Commands.UpdateEventClosureReport;

public sealed record UpdateEventClosureReportCommand(
    Guid EventId,
    Guid CurrentMemberId,
    string SummaryEn,
    string SummaryZh,
    string AttendanceNotes,
    string FinanceNotes,
    string IncidentNotes,
    string FollowUpNotes,
    IReadOnlyList<EventClosureLearningDto> Learnings,
    bool LeaderConfirmed) : IRequest<AppResult<EventClosureReportDto>>;
