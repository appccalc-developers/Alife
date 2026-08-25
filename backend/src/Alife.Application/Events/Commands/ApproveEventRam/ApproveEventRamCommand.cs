using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using MediatR;

namespace Alife.Application.Events.Commands.ApproveEventRam;

public sealed record ApproveEventRamCommand(Guid EventId, Guid CurrentMemberId, string DecisionNotes = "")
    : IRequest<AppResult<EventRamAssessmentDto>>;
