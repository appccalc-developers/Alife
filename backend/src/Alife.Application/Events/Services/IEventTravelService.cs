using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;

namespace Alife.Application.Events.Services;

public interface IEventTravelService
{
    Task<AppResult<EventTravelWorkspaceDto>> GetWorkspaceAsync(Guid eventId, Guid memberId, CancellationToken ct);
    Task<AppResult<EventTravelMyJourneysDto>> GetMyJourneysAsync(Guid eventId, Guid memberId, CancellationToken ct);
    Task<AppResult<EventTravelWorkspaceDto>> CreateDriverAsync(Guid eventId, Guid memberId, SaveEventTravelDriverRequest request, string? idempotencyKey, CancellationToken ct);
    Task<AppResult<EventTravelWorkspaceDto>> UpdateDriverAsync(Guid eventId, Guid driverId, Guid memberId, SaveEventTravelDriverRequest request, string? ifMatch, CancellationToken ct);
    Task<AppResult<EventTravelWorkspaceDto>> CreateVehicleAsync(Guid eventId, Guid memberId, SaveEventTravelVehicleRequest request, string? idempotencyKey, CancellationToken ct);
    Task<AppResult<EventTravelWorkspaceDto>> UpdateVehicleAsync(Guid eventId, Guid vehicleId, Guid memberId, SaveEventTravelVehicleRequest request, string? ifMatch, CancellationToken ct);
    Task<AppResult<EventTravelWorkspaceDto>> CreateJourneyAsync(Guid eventId, Guid memberId, CreateEventTravelJourneyRequest request, string? idempotencyKey, CancellationToken ct);
    Task<AppResult<EventTravelWorkspaceDto>> UpdateJourneyAsync(Guid eventId, Guid journeyId, Guid memberId, UpdateEventTravelJourneyRequest request, string? ifMatch, CancellationToken ct);
    Task<AppResult<EventTravelWorkspaceDto>> AddPickupStopAsync(Guid eventId, Guid journeyId, Guid memberId, SaveEventTravelPickupStopRequest request, string? ifMatch, string? idempotencyKey, CancellationToken ct);
    Task<AppResult<EventTravelWorkspaceDto>> UpdatePickupStopAsync(Guid eventId, Guid journeyId, Guid stopId, Guid memberId, SaveEventTravelPickupStopRequest request, string? ifMatch, CancellationToken ct);
    Task<AppResult<EventTravelWorkspaceDto>> AssignPassengerAsync(Guid eventId, Guid journeyId, Guid memberId, AssignEventTravelPassengerRequest request, string? ifMatch, string? idempotencyKey, CancellationToken ct);
    Task<AppResult<EventTravelWorkspaceDto>> RemovePassengerAsync(Guid eventId, Guid journeyId, Guid assignmentId, Guid memberId, string? ifMatch, string? idempotencyKey, CancellationToken ct);
}
