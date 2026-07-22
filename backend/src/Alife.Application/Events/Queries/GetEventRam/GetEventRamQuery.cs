using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using MediatR;

namespace Alife.Application.Events.Queries.GetEventRam;

public sealed record GetEventRamQuery(Guid EventId, Guid CurrentMemberId)
    : IRequest<AppResult<EventRamAssessmentDto>>;
