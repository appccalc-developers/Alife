using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using MediatR;

namespace Alife.Application.Events.Queries.GetEventRegistrationWorkspace;

public sealed record GetEventRegistrationWorkspaceQuery(Guid EventId, Guid CurrentMemberId)
    : IRequest<AppResult<EventRegistrationWorkspaceDto>>;
