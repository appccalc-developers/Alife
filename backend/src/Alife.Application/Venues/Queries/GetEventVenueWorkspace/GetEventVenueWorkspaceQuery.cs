using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Venues.Queries.GetEventVenueWorkspace;

public sealed record GetEventVenueWorkspaceQuery(Guid EventId, Guid CurrentMemberId)
    : IRequest<AppResult<EventVenueWorkspaceDto>>;
