using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Groups.Services;
using Alife.Application.Events.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Venues.Commands.SaveEventVenueBooking;

public sealed class SaveEventVenueBookingCommandHandler(IAlifeDbContext db, IGroupAuthorizationService authorization)
    : IRequestHandler<SaveEventVenueBookingCommand, AppResult<VenueBookingDto>>
{
    public async Task<AppResult<VenueBookingDto>> Handle(SaveEventVenueBookingCommand request, CancellationToken cancellationToken)
    {
        var groupEvent = await db.GroupEvents
            .Include(x => x.Plan).ThenInclude(x => x!.Occurrences)
            .FirstOrDefaultAsync(x => x.Id == request.EventId, cancellationToken);
        if (groupEvent is null) return AppResult<VenueBookingDto>.NotFound("Event not found.");
        if (!await VenueAuthorization.CanManageEventAsync(authorization, groupEvent, request.CurrentMemberId, cancellationToken))
            return AppResult<VenueBookingDto>.Forbidden("Only event group leaders and co-leaders can edit venue requests.");
        if (!EventCompositionFactory.UsesOptionalModule(groupEvent.EventDataJson, "venue"))
            return AppResult<VenueBookingDto>.Conflict("Add venue preparation to this event before creating a venue request.");
        if (request.EndUtc <= request.StartUtc)
            return AppResult<VenueBookingDto>.Validation("The booking end time must be later than its start time.");
        if (request.AttendeeCount < 1)
            return AppResult<VenueBookingDto>.Validation("Expected attendance must be positive.");
        if (!VenueAuthorization.HasLocalizedValue(request.PurposeEn, request.PurposeZh))
            return AppResult<VenueBookingDto>.Validation("An English or Chinese booking purpose is required.");

        var occurrences = groupEvent.Plan?.Occurrences.OrderBy(x => x.SortOrder).ToArray() ?? [];
        EventOccurrence? occurrence = null;
        if (request.EventOccurrenceId is Guid occurrenceId)
        {
            occurrence = occurrences.FirstOrDefault(x => x.Id == occurrenceId);
            if (occurrence is null)
                return AppResult<VenueBookingDto>.Validation("The selected session does not belong to this event.");
        }
        else if (occurrences.Length == 1)
        {
            occurrence = occurrences[0];
        }
        else if (occurrences.Length > 1)
        {
            return AppResult<VenueBookingDto>.Validation("Choose which event session needs this venue.");
        }
        if (occurrence is not null &&
            (request.StartUtc.ToUniversalTime() < occurrence.StartUtc || request.EndUtc.ToUniversalTime() > occurrence.EndUtc))
            return AppResult<VenueBookingDto>.Validation("The venue request must stay within the selected session time.");

        var space = await db.VenueSpaces.Include(x => x.Venue).FirstOrDefaultAsync(x => x.Id == request.VenueSpaceId, cancellationToken);
        if (space is null || !space.IsActive || !space.Venue.IsActive)
            return AppResult<VenueBookingDto>.Validation("The selected venue space is not available in the active catalog.");
        var church = await VenueAuthorization.FindChurchAsync(db, groupEvent.GroupId, cancellationToken);
        if (church is null || church.Id != space.Venue.ChurchGroupId)
            return AppResult<VenueBookingDto>.Forbidden("The selected venue belongs to another church.");
        if (request.AttendeeCount > space.Capacity)
            return AppResult<VenueBookingDto>.Validation("Expected attendance exceeds the selected space capacity.");

        var now = DateTime.UtcNow;
        EventVenueBooking booking;
        if (request.BookingId.HasValue)
        {
            booking = await db.EventVenueBookings
                .Include(x => x.Event)
                .Include(x => x.EventOccurrence)
                .Include(x => x.VenueSpace).ThenInclude(x => x.Venue)
                .Include(x => x.RequestedByMember)
                .Include(x => x.SubmittedByMember)
                .Include(x => x.ReviewedByMember)
                .FirstOrDefaultAsync(x => x.Id == request.BookingId.Value, cancellationToken) ?? null!;
            if (booking is null) return AppResult<VenueBookingDto>.NotFound("Venue request not found.");
            if (booking.EventId != groupEvent.Id) return AppResult<VenueBookingDto>.Forbidden("The venue request belongs to another event.");
            if (booking.Status is VenueBookingStatus.Submitted or VenueBookingStatus.Approved or VenueBookingStatus.Cancelled)
                return AppResult<VenueBookingDto>.Conflict("Only draft or rejected venue requests can be edited.");
        }
        else
        {
            booking = new EventVenueBooking
            {
                Id = Guid.NewGuid(),
                EventId = groupEvent.Id,
                RequestedByMemberId = request.CurrentMemberId,
                CreatedUtc = now
            };
            db.EventVenueBookings.Add(booking);
        }

        booking.VenueSpaceId = space.Id;
        booking.EventOccurrenceId = occurrence?.Id;
        booking.EventOccurrence = occurrence;
        booking.PurposeEn = Fallback(request.PurposeEn, request.PurposeZh);
        booking.PurposeZh = Fallback(request.PurposeZh, request.PurposeEn);
        booking.Notes = request.Notes.Trim();
        booking.StartUtc = request.StartUtc.ToUniversalTime();
        booking.EndUtc = request.EndUtc.ToUniversalTime();
        booking.AttendeeCount = request.AttendeeCount;
        booking.Status = VenueBookingStatus.Draft;
        booking.SubmittedUtc = null;
        booking.SubmittedByMemberId = null;
        booking.SubmittedByMember = null;
        booking.ReviewedByMemberId = null;
        booking.ReviewedUtc = null;
        booking.DecisionNotes = string.Empty;
        booking.UpdatedUtc = now;

        await db.SaveChangesAsync(cancellationToken);

        booking.Event = groupEvent;
        booking.VenueSpace = space;
        booking.RequestedByMember = await db.Members.FirstAsync(x => x.Id == booking.RequestedByMemberId, cancellationToken);
        return AppResult<VenueBookingDto>.Success(VenueMapper.ToDto(booking));
    }

    private static string Fallback(string primary, string secondary) =>
        string.IsNullOrWhiteSpace(primary) ? secondary.Trim() : primary.Trim();
}
