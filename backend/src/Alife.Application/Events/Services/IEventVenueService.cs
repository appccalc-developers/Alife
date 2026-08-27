using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;

namespace Alife.Application.Events.Services;

public interface IEventVenueService
{
    Task<AppResult<EventVenueCatalogueDto>> ListCatalogueAsync(Guid groupId, Guid memberId, CancellationToken ct);
    Task<AppResult<EventVenueDto>> CreateVenueAsync(Guid groupId, Guid memberId, SaveEventVenueRequest request, string? idempotencyKey, CancellationToken ct);
    Task<AppResult<EventVenueDto>> UpdateVenueAsync(Guid groupId, Guid venueId, Guid memberId, SaveEventVenueRequest request, string? ifMatch, CancellationToken ct);
    Task<AppResult<EventVenueWorkspaceDto>> GetWorkspaceAsync(Guid eventId, Guid memberId, CancellationToken ct);
    Task<AppResult<EventVenueWorkspaceDto>> ReserveAsync(Guid eventId, Guid memberId, ReserveEventVenueRequest request, string? ifMatch, string? idempotencyKey, CancellationToken ct);
    Task<AppResult<EventVenueWorkspaceDto>> ReleaseAsync(Guid eventId, Guid reservationId, Guid memberId, string? ifMatch, string? idempotencyKey, CancellationToken ct);
}
