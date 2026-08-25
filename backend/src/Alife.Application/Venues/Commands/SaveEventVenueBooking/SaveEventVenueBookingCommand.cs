using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Venues.Commands.SaveEventVenueBooking;

public sealed record SaveEventVenueBookingCommand(
    Guid EventId,
    Guid? BookingId,
    Guid CurrentMemberId,
    Guid? EventOccurrenceId,
    Guid VenueSpaceId,
    string PurposeEn,
    string PurposeZh,
    string Notes,
    DateTime StartUtc,
    DateTime EndUtc,
    int AttendeeCount)
    : IRequest<AppResult<VenueBookingDto>>;
