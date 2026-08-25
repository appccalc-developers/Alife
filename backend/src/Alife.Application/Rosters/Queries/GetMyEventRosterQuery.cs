using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Rosters.Queries;

public sealed record GetMyEventRosterQuery(Guid EventId, Guid CurrentMemberId)
    : IRequest<AppResult<MyEventRosterWorkspaceDto>>;
