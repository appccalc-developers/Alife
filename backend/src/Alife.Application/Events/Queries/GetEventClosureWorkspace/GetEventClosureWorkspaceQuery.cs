using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using MediatR;

namespace Alife.Application.Events.Queries.GetEventClosureWorkspace;

public sealed record GetEventClosureWorkspaceQuery(Guid EventId, Guid CurrentMemberId)
    : IRequest<AppResult<EventClosureWorkspaceDto>>;
