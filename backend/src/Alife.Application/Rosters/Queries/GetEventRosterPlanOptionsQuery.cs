using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Rosters.Queries;

public sealed record GetEventRosterPlanOptionsQuery(Guid EventId, Guid CurrentMemberId)
    : IRequest<AppResult<EventRosterPlanOptionsDto>>;
