using Alife.Domain.Entities;

namespace Alife.Application.Venues;

internal static class VenueMapper
{
    public static IReadOnlyDictionary<string, string> Text(string en, string zh) =>
        new Dictionary<string, string> { ["en"] = en, ["zh"] = zh };

    public static VenueDto ToDto(Venue venue) => new(
        venue.Id,
        venue.ChurchGroupId,
        Text(venue.NameEn, venue.NameZh),
        Text(venue.DescriptionEn, venue.DescriptionZh),
        Text(venue.AddressEn, venue.AddressZh),
        venue.TimeZoneId,
        venue.IsActive,
        venue.UpdatedUtc,
        venue.Spaces.OrderBy(x => x.NameEn).ThenBy(x => x.NameZh).Select(ToDto).ToArray());

    public static VenueSpaceDto ToDto(VenueSpace space) => new(
        space.Id,
        Text(space.NameEn, space.NameZh),
        space.Capacity,
        space.ResourcesJson,
        space.BookingPolicyJson,
        space.IsActive);

    public static VenueBookingDto ToDto(EventVenueBooking booking) => new(
        booking.Id,
        booking.EventId,
        booking.EventOccurrenceId,
        booking.EventOccurrence is null ? null : Text(booking.EventOccurrence.NameEn, booking.EventOccurrence.NameZh),
        booking.VenueSpaceId,
        booking.VenueSpace.VenueId,
        Text(booking.VenueSpace.Venue.NameEn, booking.VenueSpace.Venue.NameZh),
        Text(booking.VenueSpace.NameEn, booking.VenueSpace.NameZh),
        Text(booking.Event.TitleEn, booking.Event.TitleZh),
        Text(booking.PurposeEn, booking.PurposeZh),
        booking.Notes,
        booking.DecisionNotes,
        booking.StartUtc,
        booking.EndUtc,
        booking.AttendeeCount,
        booking.Status,
        booking.RequestedByMemberId,
        booking.RequestedByMember.DisplayName,
        booking.SubmittedByMemberId,
        booking.SubmittedByMember?.DisplayName,
        booking.ReviewedByMemberId,
        booking.ReviewedByMember?.DisplayName,
        booking.SubmittedUtc,
        booking.ReviewedUtc,
        booking.UpdatedUtc);
}
