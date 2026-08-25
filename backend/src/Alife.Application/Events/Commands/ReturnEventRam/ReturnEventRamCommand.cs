using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using MediatR;

namespace Alife.Application.Events.Commands.ReturnEventRam;

public sealed record ReturnEventRamCommand(Guid EventId, Guid CurrentMemberId, string DecisionNotes)
    : IRequest<AppResult<EventRamAssessmentDto>>;
