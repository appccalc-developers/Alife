using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Rosters.Commands;

public sealed record ConfirmRosterAssignmentCommand(
    Guid EventId, Guid ShiftId, Guid MemberId, Guid CurrentMemberId,
    bool BasedOnSmartSuggestion, string? ConfirmationNotes) : IRequest<AppResult<RosterAssignmentDto>>;
