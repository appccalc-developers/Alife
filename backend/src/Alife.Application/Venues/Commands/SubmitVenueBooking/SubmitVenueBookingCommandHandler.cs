using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Groups.Services;
using Alife.Application.Events.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Venues.Commands.SubmitVenueBooking;

public sealed class SubmitVenueBookingCommandHandler(IAlifeDbContext db, IGroupAuthorizationService authorization)
    : IRequestHandler<SubmitVenueBookingCommand, AppResult<VenueBookingDto>>
{
    public async Task<AppResult<VenueBookingDto>> Handle(SubmitVenueBookingCommand request, CancellationToken cancellationToken)
    {
        var booking = await db.EventVenueBookings
            .Include(x => x.Event)
            .Include(x => x.EventOccurrence)
            .Include(x => x.VenueSpace).ThenInclude(x => x.Venue)
            .Include(x => x.RequestedByMember)
            .Include(x => x.SubmittedByMember)
            .Include(x => x.ReviewedByMember)
            .FirstOrDefaultAsync(x => x.Id == request.BookingId && x.EventId == request.EventId, cancellationToken);
        if (booking is null) return AppResult<VenueBookingDto>.NotFound("Venue request not found.");
        if (!await VenueAuthorization.CanManageEventAsync(authorization, booking.Event, request.CurrentMemberId, cancellationToken))
            return AppResult<VenueBookingDto>.Forbidden("Only event group leaders and co-leaders can submit venue requests.");
        if (!EventCompositionFactory.UsesOptionalModule(booking.Event.EventDataJson, "venue"))
            return AppResult<VenueBookingDto>.Conflict("Venue preparation was removed from this event. Add it again before submitting the request.");
        if (booking.Status != VenueBookingStatus.Draft)
            return AppResult<VenueBookingDto>.Conflict("Only a draft venue request can be submitted.");
        if (!booking.VenueSpace.IsActive || !booking.VenueSpace.Venue.IsActive)
            return AppResult<VenueBookingDto>.Conflict("The selected venue space is no longer active. Choose another space before submitting.");

        booking.Status = VenueBookingStatus.Submitted;
        booking.SubmittedByMemberId = request.CurrentMemberId;
        booking.SubmittedByMember = await db.Members.FirstAsync(x => x.Id == request.CurrentMemberId, cancellationToken);
        booking.SubmittedUtc = DateTime.UtcNow;
        booking.UpdatedUtc = booking.SubmittedUtc.Value;
        db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            ActorMemberId = request.CurrentMemberId,
            Action = "venue.booking.submitted",
            EntityType = nameof(Alife.Domain.Entities.EventVenueBooking),
            EntityId = booking.Id,
            GroupId = booking.Event.GroupId,
            EventId = booking.EventId,
            OccurredUtc = booking.SubmittedUtc.Value
        });
        await db.SaveChangesAsync(cancellationToken);
        return AppResult<VenueBookingDto>.Success(VenueMapper.ToDto(booking));
    }
}
