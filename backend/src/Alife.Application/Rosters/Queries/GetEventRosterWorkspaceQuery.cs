using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Rosters.Queries;

public sealed record GetEventRosterWorkspaceQuery(Guid EventId, Guid CurrentMemberId)
    : IRequest<AppResult<EventRosterWorkspaceDto>>;
