using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Groups.Services;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Rosters.Queries;

public sealed class GetRosterSuggestionsQueryHandler(IAlifeDbContext db, IGroupAuthorizationService authorization)
    : IRequestHandler<GetRosterSuggestionsQuery, AppResult<IReadOnlyList<RosterCandidateSuggestionDto>>>
{
    public async Task<AppResult<IReadOnlyList<RosterCandidateSuggestionDto>>> Handle(GetRosterSuggestionsQuery request, CancellationToken cancellationToken)
    {
        var groupEvent = await RosterPolicy.GetManagedEventAsync(db, authorization, request.EventId, request.CurrentMemberId, cancellationToken);
        if (groupEvent is null) return AppResult<IReadOnlyList<RosterCandidateSuggestionDto>>.Forbidden("Event not found or roster permission denied.");
        if (!RosterPolicy.IsEnabled(groupEvent))
            return AppResult<IReadOnlyList<RosterCandidateSuggestionDto>>.Conflict("Roster preparation is not enabled for this event.");
        var shift = await db.EventRosterShifts.AsNoTracking().FirstOrDefaultAsync(
            x => x.Id == request.ShiftId && x.EventId == groupEvent.Id, cancellationToken);
        if (shift is null) return AppResult<IReadOnlyList<RosterCandidateSuggestionDto>>.NotFound("Roster shift not found.");
        return AppResult<IReadOnlyList<RosterCandidateSuggestionDto>>.Success(
            await RosterSuggestionEngine.SuggestAsync(db, groupEvent, shift, cancellationToken));
    }
}
