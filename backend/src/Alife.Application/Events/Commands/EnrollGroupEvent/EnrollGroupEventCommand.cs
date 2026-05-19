using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using MediatR;

namespace Alife.Application.Events.Commands.EnrollGroupEvent;

public sealed record EnrollGroupEventCommand(
    Guid GroupId,
    Guid CurrentMemberId,
    Guid EventId,
    string EnrollmentJson) : IRequest<AppResult<EventEnrollmentDto>>;
