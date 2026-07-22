using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using MediatR;

namespace Alife.Application.Events.Commands.SubmitEventRam;

public sealed record SubmitEventRamCommand(Guid EventId, Guid CurrentMemberId)
    : IRequest<AppResult<EventRamAssessmentDto>>;
