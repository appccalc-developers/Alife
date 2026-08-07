using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Domain.Enums;
using MediatR;

namespace Alife.Application.Events.Commands.UpdateEventWorkflowStep;

public sealed record UpdateEventWorkflowStepCommand(
    Guid EventId,
    Guid StepId,
    Guid CurrentMemberId,
    EventWorkflowStepStatus Status,
    Guid? AssignedMemberId,
    DateTime? DueUtc) : IRequest<AppResult<EventWorkflowDto>>;
