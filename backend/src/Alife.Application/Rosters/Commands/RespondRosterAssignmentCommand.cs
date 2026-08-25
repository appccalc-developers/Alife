using Alife.Application.Common.Models;
using Alife.Domain.Enums;
using MediatR;

namespace Alife.Application.Rosters.Commands;

public sealed record RespondRosterAssignmentCommand(
    Guid EventId,
    Guid AssignmentId,
    Guid CurrentMemberId,
    EventRosterMemberResponse Response,
    string? Notes) : IRequest<AppResult<MyRosterAssignmentDto>>;
