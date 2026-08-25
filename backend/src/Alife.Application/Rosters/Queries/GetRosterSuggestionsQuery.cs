using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Rosters.Queries;

public sealed record GetRosterSuggestionsQuery(Guid EventId, Guid ShiftId, Guid CurrentMemberId)
    : IRequest<AppResult<IReadOnlyList<RosterCandidateSuggestionDto>>>;
