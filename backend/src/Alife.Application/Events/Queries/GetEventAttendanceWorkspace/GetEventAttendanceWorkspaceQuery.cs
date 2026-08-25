using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using MediatR;

namespace Alife.Application.Events.Queries.GetEventAttendanceWorkspace;

public sealed record GetEventAttendanceWorkspaceQuery(Guid EventId, Guid CurrentMemberId)
    : IRequest<AppResult<EventAttendanceWorkspaceDto>>;
