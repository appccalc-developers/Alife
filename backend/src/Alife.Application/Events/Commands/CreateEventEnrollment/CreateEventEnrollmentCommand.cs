using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using MediatR;

namespace Alife.Application.Events.Commands.CreateEventEnrollment;

public sealed record CreateEventEnrollmentCommand(
    Guid EventId,
    Guid CurrentMemberId,
    string EnrollmentJson,
    Guid? RequestedId)
    : IRequest<AppResult<EventEnrollmentDto>>;
