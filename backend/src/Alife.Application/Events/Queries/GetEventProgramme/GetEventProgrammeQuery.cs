using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using MediatR;

namespace Alife.Application.Events.Queries.GetEventProgramme;

public sealed record GetEventProgrammeQuery(Guid EventId, Guid CurrentMemberId)
    : IRequest<AppResult<EventProgrammeWorkspaceDto>>;
