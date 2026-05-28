using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using MediatR;

namespace Alife.Application.Events.Commands.UpdateEventEnrollment;

public sealed record UpdateEventEnrollmentCommand(
    Guid EventId,
    Guid EnrollmentId,
    Guid CurrentMemberId,
    string EnrollmentJson)
    : IRequest<AppResult<EventEnrollmentDto>>;
