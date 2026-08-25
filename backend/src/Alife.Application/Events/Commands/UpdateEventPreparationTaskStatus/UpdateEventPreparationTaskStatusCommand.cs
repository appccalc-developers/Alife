using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Domain.Enums;
using MediatR;

namespace Alife.Application.Events.Commands.UpdateEventPreparationTaskStatus;

public sealed record UpdateEventPreparationTaskStatusCommand(
    Guid EventId,
    Guid TaskId,
    Guid CurrentMemberId,
    EventPreparationTaskStatus Status)
    : IRequest<AppResult<EventPreparationTaskDto>>;
