using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using MediatR;

namespace Alife.Application.Events.Commands.SaveEventAttendanceRecord;

public sealed record SaveEventAttendanceRecordCommand(
    Guid EventId,
    Guid CurrentMemberId,
    Guid EventOccurrenceId,
    Guid? EventEnrollmentId,
    int AttendedUnits,
    string Notes) : IRequest<AppResult<EventAttendanceRecordDto>>;
