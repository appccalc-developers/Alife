using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Events.Commands.DeleteEventEnrollment;

public sealed record DeleteEventEnrollmentCommand(
    Guid EventId,
    Guid EnrollmentId,
    Guid CurrentMemberId)
    : IRequest<AppResult<bool>>;
