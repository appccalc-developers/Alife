using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Venues.Commands.SubmitVenueBooking;

public sealed record SubmitVenueBookingCommand(Guid EventId, Guid BookingId, Guid CurrentMemberId)
    : IRequest<AppResult<VenueBookingDto>>;
