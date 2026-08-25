using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Venues.Queries.ListVenueBookingsForReview;

public sealed record ListVenueBookingsForReviewQuery(Guid? ChurchGroupId, Guid CurrentMemberId)
    : IRequest<AppResult<IReadOnlyList<VenueBookingDto>>>;
