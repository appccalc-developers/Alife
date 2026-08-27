using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;

namespace Alife.Application.Events.Services;

public interface IEventSafeguardingService
{
    Task<AppResult<EventSafeguardingWorkspaceDto>> GetWorkspaceAsync(Guid eventId, Guid? occurrenceId, Guid memberId, CancellationToken ct);
    Task<AppResult<EventSafeguardingMyContextDto>> GetMyContextAsync(Guid eventId, Guid memberId, CancellationToken ct);
    Task<AppResult<EventSafeguardingWorkspaceDto>> ConfigurePolicyAsync(Guid eventId, Guid memberId, ConfigureEventSafeguardingRequest request, string ifMatch, string idempotencyKey, CancellationToken ct);
    Task<AppResult<EventSafeguardingWorkspaceDto>> RegisterChildAsync(Guid eventId, Guid memberId, CreateEventChildRegistrationRequest request, string idempotencyKey, CancellationToken ct);
    Task<AppResult<EventSafeguardingWorkspaceDto>> AddGuardianAsync(Guid eventId, Guid childId, Guid memberId, CreateEventChildGuardianRequest request, string ifMatch, string idempotencyKey, CancellationToken ct);
    Task<AppResult<EventSafeguardingMyContextDto>> ConfirmGuardianAsync(Guid eventId, Guid relationshipId, Guid memberId, string ifMatch, string idempotencyKey, CancellationToken ct);
    Task<AppResult<EventSafeguardingMyContextDto>> RecordConsentAsync(Guid eventId, Guid relationshipId, Guid memberId, RecordEventChildConsentRequest request, string ifMatch, string idempotencyKey, CancellationToken ct);
    Task<AppResult<EventSafeguardingMyContextDto>> AddCollectorAsync(Guid eventId, Guid childId, Guid memberId, CreateEventChildCollectorRequest request, string idempotencyKey, CancellationToken ct);
    Task<AppResult<EventSafeguardingMyContextDto>> RevokeCollectorAsync(Guid eventId, Guid collectorId, Guid memberId, string ifMatch, string idempotencyKey, CancellationToken ct);
    Task<AppResult<EventSafeguardingWorkspaceDto>> SaveWorkerEvidenceAsync(Guid eventId, Guid memberId, SaveEventSafeguardingWorkerEvidenceRequest request, string idempotencyKey, CancellationToken ct);
    Task<AppResult<EventSafeguardingWorkspaceDto>> CheckInAsync(Guid eventId, Guid occurrenceId, Guid childId, Guid memberId, string ifMatch, string idempotencyKey, CancellationToken ct);
    Task<AppResult<EventSafeguardingWorkspaceDto>> CheckOutAsync(Guid eventId, Guid occurrenceId, Guid childId, Guid memberId, CheckOutEventChildRequest request, string ifMatch, string idempotencyKey, CancellationToken ct);
}
