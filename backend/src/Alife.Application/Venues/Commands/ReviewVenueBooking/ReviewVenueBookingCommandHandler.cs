using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Transactions;

namespace Alife.Application.Venues.Commands.ReviewVenueBooking;

public sealed class ReviewVenueBookingCommandHandler(IAlifeDbContext db)
    : IRequestHandler<ReviewVenueBookingCommand, AppResult<VenueBookingDto>>
{
    public async Task<AppResult<VenueBookingDto>> Handle(ReviewVenueBookingCommand request, CancellationToken cancellationToken)
    {
        if (!await VenueAuthorization.CanReviewBookingsAsync(db, request.CurrentMemberId, cancellationToken))
            return AppResult<VenueBookingDto>.Forbidden("You do not have permission to review venue requests.");

        using var transaction = new TransactionScope(
            TransactionScopeOption.Required,
            new TransactionOptions { IsolationLevel = IsolationLevel.Serializable, Timeout = TimeSpan.FromSeconds(15) },
            TransactionScopeAsyncFlowOption.Enabled);

        var booking = await db.EventVenueBookings
            .Include(x => x.Event)
            .Include(x => x.EventOccurrence)
            .Include(x => x.VenueSpace).ThenInclude(x => x.Venue)
            .Include(x => x.RequestedByMember)
            .Include(x => x.SubmittedByMember)
            .Include(x => x.ReviewedByMember)
            .FirstOrDefaultAsync(x => x.Id == request.BookingId, cancellationToken);
        if (booking is null) return AppResult<VenueBookingDto>.NotFound("Venue request not found.");
        if (booking.Status != VenueBookingStatus.Submitted)
            return AppResult<VenueBookingDto>.Conflict("Only a submitted venue request can be reviewed.");
        if (booking.RequestedByMemberId == request.CurrentMemberId || booking.SubmittedByMemberId == request.CurrentMemberId)
            return AppResult<VenueBookingDto>.Forbidden("The person who created or submitted this venue request cannot review it.");
        if (!request.Approve && string.IsNullOrWhiteSpace(request.DecisionNotes))
            return AppResult<VenueBookingDto>.Validation("A reason is required when rejecting a venue request.");

        if (request.Approve)
        {
            if (!booking.VenueSpace.IsActive || !booking.VenueSpace.Venue.IsActive)
                return AppResult<VenueBookingDto>.Conflict("This venue or space is no longer available for booking.");
            if (booking.AttendeeCount > booking.VenueSpace.Capacity)
                return AppResult<VenueBookingDto>.Conflict("The requested attendance now exceeds the maintained space capacity.");
            var conflict = await db.EventVenueBookings.AsNoTracking().AnyAsync(x =>
                x.Id != booking.Id &&
                x.VenueSpaceId == booking.VenueSpaceId &&
                x.Status == VenueBookingStatus.Approved &&
                x.StartUtc < booking.EndUtc && booking.StartUtc < x.EndUtc,
                cancellationToken);
            if (conflict)
                return AppResult<VenueBookingDto>.Conflict("This space already has an approved booking during the requested time.");
        }

        var now = DateTime.UtcNow;
        booking.Status = request.Approve ? VenueBookingStatus.Approved : VenueBookingStatus.Rejected;
        booking.DecisionNotes = request.DecisionNotes.Trim();
        booking.ReviewedByMemberId = request.CurrentMemberId;
        booking.ReviewedUtc = now;
        booking.UpdatedUtc = now;
        db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            ActorMemberId = request.CurrentMemberId,
            Action = request.Approve ? "venue.booking.approved" : "venue.booking.rejected",
            EntityType = nameof(EventVenueBooking),
            EntityId = booking.Id,
            GroupId = booking.VenueSpace.Venue.ChurchGroupId,
            EventId = booking.EventId,
            MetadataJson = System.Text.Json.JsonSerializer.Serialize(new
            {
                booking.VenueSpaceId,
                booking.StartUtc,
                booking.EndUtc,
                booking.AttendeeCount
            }),
            OccurredUtc = now
        });
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return AppResult<VenueBookingDto>.Conflict("The venue request changed while it was being reviewed. Reload and try again.");
        }

        booking.ReviewedByMember = await db.Members.FirstAsync(x => x.Id == request.CurrentMemberId, cancellationToken);
        transaction.Complete();
        return AppResult<VenueBookingDto>.Success(VenueMapper.ToDto(booking));
    }
}
