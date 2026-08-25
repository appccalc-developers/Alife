using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Groups.Services;
using Alife.Application.Events.Services;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Venues.Queries.GetEventVenueWorkspace;

public sealed class GetEventVenueWorkspaceQueryHandler(IAlifeDbContext db, IGroupAuthorizationService authorization)
    : IRequestHandler<GetEventVenueWorkspaceQuery, AppResult<EventVenueWorkspaceDto>>
{
    public async Task<AppResult<EventVenueWorkspaceDto>> Handle(GetEventVenueWorkspaceQuery request, CancellationToken cancellationToken)
    {
        var groupEvent = await db.GroupEvents.AsNoTracking()
            .Include(x => x.Plan).ThenInclude(x => x!.Occurrences)
            .FirstOrDefaultAsync(x => x.Id == request.EventId, cancellationToken);
        if (groupEvent is null) return AppResult<EventVenueWorkspaceDto>.NotFound("Event not found.");
        if (!await VenueAuthorization.CanManageEventAsync(authorization, groupEvent, request.CurrentMemberId, cancellationToken))
            return AppResult<EventVenueWorkspaceDto>.Forbidden("Only event group leaders and co-leaders can request a venue.");
        if (!EventCompositionFactory.UsesOptionalModule(groupEvent.EventDataJson, "venue"))
            return AppResult<EventVenueWorkspaceDto>.Conflict("Add venue preparation to this event before creating a venue request.");

        var church = await VenueAuthorization.FindChurchAsync(db, groupEvent.GroupId, cancellationToken);
        if (church is null) return AppResult<EventVenueWorkspaceDto>.Validation("The event group is not connected to a church venue catalog.");

        var venues = await db.Venues.AsNoTracking()
            .Include(x => x.Spaces)
            .Where(x => x.ChurchGroupId == church.Id && x.IsActive)
            .OrderBy(x => x.NameEn).ThenBy(x => x.NameZh)
            .ToListAsync(cancellationToken);
        foreach (var venue in venues) venue.Spaces = venue.Spaces.Where(x => x.IsActive).ToList();

        var bookings = await db.EventVenueBookings.AsNoTracking()
            .Include(x => x.Event)
            .Include(x => x.EventOccurrence)
            .Include(x => x.VenueSpace).ThenInclude(x => x.Venue)
            .Include(x => x.RequestedByMember)
            .Include(x => x.SubmittedByMember)
            .Include(x => x.ReviewedByMember)
            .Where(x => x.EventId == groupEvent.Id)
            .OrderBy(x => x.StartUtc)
            .ToListAsync(cancellationToken);

        return AppResult<EventVenueWorkspaceDto>.Success(new EventVenueWorkspaceDto(
            groupEvent.Id,
            groupEvent.GroupId,
            church.Id,
            VenueMapper.Text(groupEvent.TitleEn, groupEvent.TitleZh),
            groupEvent.StartDate,
            groupEvent.EndDate,
            groupEvent.Plan?.Occurrences.OrderBy(x => x.SortOrder).Select(x => new VenueOccurrenceDto(
                x.Id, VenueMapper.Text(x.NameEn, x.NameZh), x.StartUtc, x.EndUtc, x.TimeZoneId, x.SortOrder)).ToArray() ?? [],
            venues.Select(VenueMapper.ToDto).ToArray(),
            bookings.Select(VenueMapper.ToDto).ToArray()));
    }
}
