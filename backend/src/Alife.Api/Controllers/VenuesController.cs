using Alife.Api.Http;
using Alife.Api.Results;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Venues.Commands.ReviewVenueBooking;
using Alife.Application.Venues.Commands.SaveEventVenueBooking;
using Alife.Application.Venues.Commands.SaveVenue;
using Alife.Application.Venues.Commands.SubmitVenueBooking;
using Alife.Application.Venues.Queries.GetEventVenueWorkspace;
using Alife.Application.Venues.Queries.ListManagedVenues;
using Alife.Application.Venues.Queries.ListVenueBookingsForReview;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Controllers;

[ApiController]
[Route("api")]
[Authorize]
public sealed class VenuesController(IMediator mediator, ICurrentMemberAccessor currentMemberAccessor) : ControllerBase
{
    [HttpGet("admin/venues")]
    public async Task<IActionResult> ListManaged([FromQuery] Guid churchGroupId, CancellationToken cancellationToken)
    {
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        var result = await mediator.Send(new ListManagedVenuesQuery(churchGroupId, memberId.Value), cancellationToken);
        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpPost("admin/venues")]
    public Task<IActionResult> Create([FromBody] SaveVenueRequest request, CancellationToken cancellationToken) =>
        Save(null, request, cancellationToken);

    [HttpPut("admin/venues/{venueId:guid}")]
    public Task<IActionResult> Update(Guid venueId, [FromBody] SaveVenueRequest request, CancellationToken cancellationToken) =>
        Save(venueId, request, cancellationToken);

    [HttpGet("events/{eventId:guid}/venue-workspace")]
    public async Task<IActionResult> GetEventWorkspace(Guid eventId, CancellationToken cancellationToken)
    {
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        var result = await mediator.Send(new GetEventVenueWorkspaceQuery(eventId, memberId.Value), cancellationToken);
        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpPost("events/{eventId:guid}/venue-bookings")]
    public Task<IActionResult> CreateBooking(Guid eventId, [FromBody] SaveVenueBookingRequest request, CancellationToken cancellationToken) =>
        SaveBooking(eventId, null, request, cancellationToken);

    [HttpPut("events/{eventId:guid}/venue-bookings/{bookingId:guid}")]
    public Task<IActionResult> UpdateBooking(Guid eventId, Guid bookingId, [FromBody] SaveVenueBookingRequest request, CancellationToken cancellationToken) =>
        SaveBooking(eventId, bookingId, request, cancellationToken);

    [HttpPost("events/{eventId:guid}/venue-bookings/{bookingId:guid}/submit")]
    public async Task<IActionResult> SubmitBooking(Guid eventId, Guid bookingId, CancellationToken cancellationToken)
    {
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        return this.ToActionResult(await mediator.Send(new SubmitVenueBookingCommand(eventId, bookingId, memberId.Value), cancellationToken));
    }

    [HttpGet("admin/venue-bookings")]
    public async Task<IActionResult> ListBookingsForReview([FromQuery] Guid? churchGroupId, CancellationToken cancellationToken)
    {
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        var result = await mediator.Send(new ListVenueBookingsForReviewQuery(churchGroupId, memberId.Value), cancellationToken);
        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpPost("admin/venue-bookings/{bookingId:guid}/decision")]
    public async Task<IActionResult> ReviewBooking(Guid bookingId, [FromBody] ReviewVenueBookingRequest request, CancellationToken cancellationToken)
    {
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        return this.ToActionResult(await mediator.Send(
            new ReviewVenueBookingCommand(bookingId, memberId.Value, request.Approve, request.DecisionNotes),
            cancellationToken));
    }

    private async Task<IActionResult> Save(Guid? venueId, SaveVenueRequest request, CancellationToken cancellationToken)
    {
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        var result = await mediator.Send(new SaveVenueCommand(
            venueId,
            request.ChurchGroupId,
            memberId.Value,
            request.NameEn,
            request.NameZh,
            request.DescriptionEn,
            request.DescriptionZh,
            request.AddressEn,
            request.AddressZh,
            request.TimeZoneId,
            request.IsActive,
            (request.Spaces ?? []).Select(x => new SaveVenueSpaceInput(
                x.Id, x.NameEn, x.NameZh, x.Capacity, x.ResourcesJson, x.BookingPolicyJson, x.IsActive)).ToArray()),
            cancellationToken);
        return venueId.HasValue || !result.IsSuccess
            ? this.ToActionResult(result)
            : Created($"/api/admin/venues/{result.Value!.Id}", result.Value);
    }

    private async Task<IActionResult> SaveBooking(
        Guid eventId,
        Guid? bookingId,
        SaveVenueBookingRequest request,
        CancellationToken cancellationToken)
    {
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        var result = await mediator.Send(new SaveEventVenueBookingCommand(
            eventId,
            bookingId,
            memberId.Value,
            request.EventOccurrenceId,
            request.VenueSpaceId,
            request.PurposeEn,
            request.PurposeZh,
            request.Notes,
            request.StartUtc,
            request.EndUtc,
            request.AttendeeCount), cancellationToken);
        return bookingId.HasValue || !result.IsSuccess
            ? this.ToActionResult(result)
            : Created($"/api/events/{eventId}/venue-bookings/{result.Value!.Id}", result.Value);
    }

    public sealed record SaveVenueRequest(
        Guid ChurchGroupId,
        string NameEn,
        string NameZh,
        string DescriptionEn,
        string DescriptionZh,
        string AddressEn,
        string AddressZh,
        string TimeZoneId,
        bool IsActive,
        IReadOnlyList<SaveVenueSpaceRequest>? Spaces);

    public sealed record SaveVenueSpaceRequest(
        Guid? Id,
        string NameEn,
        string NameZh,
        int Capacity,
        string ResourcesJson,
        string BookingPolicyJson,
        bool IsActive);

    public sealed record SaveVenueBookingRequest(
        Guid? EventOccurrenceId,
        Guid VenueSpaceId,
        string PurposeEn,
        string PurposeZh,
        string Notes,
        DateTime StartUtc,
        DateTime EndUtc,
        int AttendeeCount);

    public sealed record ReviewVenueBookingRequest(bool Approve, string DecisionNotes);
}
