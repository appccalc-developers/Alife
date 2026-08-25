using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Rosters.Commands;

public sealed record CancelRosterAssignmentCommand(Guid EventId, Guid AssignmentId, Guid CurrentMemberId)
    : IRequest<AppResult<bool>>;
