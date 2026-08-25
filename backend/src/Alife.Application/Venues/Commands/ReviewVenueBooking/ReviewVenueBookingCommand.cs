using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Venues.Commands.ReviewVenueBooking;

public sealed record ReviewVenueBookingCommand(
    Guid BookingId,
    Guid CurrentMemberId,
    bool Approve,
    string DecisionNotes)
    : IRequest<AppResult<VenueBookingDto>>;
