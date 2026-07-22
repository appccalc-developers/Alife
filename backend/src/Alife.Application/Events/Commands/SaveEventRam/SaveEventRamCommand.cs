using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using MediatR;

namespace Alife.Application.Events.Commands.SaveEventRam;

public sealed record SaveEventRamCommand(Guid EventId, Guid CurrentMemberId, string RamDataJson)
    : IRequest<AppResult<EventRamAssessmentDto>>;
