using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Venues.Queries.ListVenueBookingsForReview;

public sealed class ListVenueBookingsForReviewQueryHandler(IAlifeDbContext db)
    : IRequestHandler<ListVenueBookingsForReviewQuery, AppResult<IReadOnlyList<VenueBookingDto>>>
{
    public async Task<AppResult<IReadOnlyList<VenueBookingDto>>> Handle(ListVenueBookingsForReviewQuery request, CancellationToken cancellationToken)
    {
        if (!await VenueAuthorization.CanReviewBookingsAsync(db, request.CurrentMemberId, cancellationToken))
            return AppResult<IReadOnlyList<VenueBookingDto>>.Forbidden("You do not have permission to review venue requests.");

        var query = db.EventVenueBookings.AsNoTracking()
            .Include(x => x.Event)
            .Include(x => x.EventOccurrence)
            .Include(x => x.VenueSpace).ThenInclude(x => x.Venue)
            .Include(x => x.RequestedByMember)
            .Include(x => x.SubmittedByMember)
            .Include(x => x.ReviewedByMember)
            .Where(x => x.Status == Alife.Domain.Enums.VenueBookingStatus.Submitted);
        if (request.ChurchGroupId.HasValue)
            query = query.Where(x => x.VenueSpace.Venue.ChurchGroupId == request.ChurchGroupId.Value);

        var bookings = await query.OrderBy(x => x.StartUtc).ToListAsync(cancellationToken);
        return AppResult<IReadOnlyList<VenueBookingDto>>.Success(bookings.Select(VenueMapper.ToDto).ToArray());
    }
}
