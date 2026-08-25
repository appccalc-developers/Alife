using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using MediatR;

namespace Alife.Application.Events.Queries.GetEventFinanceWorkspace;

public sealed record GetEventFinanceWorkspaceQuery(Guid EventId, Guid CurrentMemberId)
    : IRequest<AppResult<EventFinanceWorkspaceDto>>;
