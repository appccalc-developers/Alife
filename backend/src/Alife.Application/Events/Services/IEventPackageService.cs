using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Domain.Enums;

namespace Alife.Application.Events.Services;

public interface IEventPackageService
{
    Task<AppResult<EventPackagePageDto>> ListAsync(Guid eventId, Guid memberId,
        ListEventPackagesRequest request, CancellationToken ct);
    Task<AppResult<EventPackageDto>> GetCurrentAsync(Guid eventId, Guid memberId,
        EventPackageScopeType scopeType, Guid? scopeId, CancellationToken ct);
    Task<AppResult<EventPackageDto>> GetAsync(Guid eventId, Guid packageId, Guid memberId, CancellationToken ct);
    Task<AppResult<EventPackageDiffDto>> DiffAsync(Guid eventId, Guid packageId, Guid otherPackageId,
        Guid memberId, CancellationToken ct);
    Task<AppResult<EventPackageActorCapabilitiesDto>> GetCapabilitiesAsync(Guid eventId, Guid packageId,
        Guid memberId, CancellationToken ct);
    Task<AppResult<EventPackageDto>> GenerateAsync(Guid eventId, Guid memberId, GenerateEventPackageRequest request,
        string? ifMatch, string? idempotencyKey, CancellationToken ct);
    Task<AppResult<EventPackageDto>> SubmitAsync(Guid eventId, Guid packageId, Guid memberId,
        string? ifMatch, string? idempotencyKey, CancellationToken ct);
    Task<AppResult<EventPackageDto>> WithdrawAsync(Guid eventId, Guid packageId, Guid memberId,
        string? ifMatch, string? idempotencyKey, CancellationToken ct);
    Task<AppResult<EventPackageDto>> DecideAsync(Guid eventId, Guid packageId, Guid memberId,
        EventPackageDecisionRequest request, string? ifMatch, string? idempotencyKey, CancellationToken ct);
    Task<AppResult<EventLifecycleDto>> GetLifecycleAsync(
        Guid eventId, Guid memberId, CancellationToken ct, Guid? occurrenceId = null);
    Task<AppResult<EventLifecycleDto>> PublishAsync(Guid eventId, Guid memberId, PublishEventRequest request,
        string? idempotencyKey, CancellationToken ct);
    Task<AppResult<EventLifecycleDto>> UnpublishAsync(Guid eventId, Guid memberId, UnpublishEventRequest request,
        string? idempotencyKey, CancellationToken ct);
    Task<AppResult<EventPackageDto>> RevokeDecisionAsync(Guid eventId, Guid packageId, Guid decisionId, Guid memberId,
        RevokeEventPackageDecisionRequest request, string? ifMatch, string? idempotencyKey, CancellationToken ct);
    Task<AppResult<EventPackageConditionResultDto>> SatisfyConditionAsync(Guid eventId, Guid packageId, Guid conditionId,
        Guid memberId, SatisfyEventPackageConditionRequest request, string? ifMatch, string? idempotencyKey, CancellationToken ct);
    Task<AppResult<EventPackageConditionResultDto>> VerifyConditionAsync(Guid eventId, Guid packageId, Guid conditionId,
        Guid memberId, VerifyEventPackageConditionRequest request, string? ifMatch, string? idempotencyKey, CancellationToken ct);
    Task<AppResult<EventPackageConditionResultDto>> WaiveConditionAsync(Guid eventId, Guid packageId, Guid conditionId,
        Guid memberId, WaiveEventPackageConditionRequest request, string? ifMatch, string? idempotencyKey, CancellationToken ct);
    Task<AppResult<EventLifecycleDto>> OpenRegistrationAsync(Guid eventId, Guid memberId,
        OpenEventRegistrationRequest request, string? idempotencyKey, CancellationToken ct);
    Task<AppResult<EventLifecycleDto>> CloseRegistrationAsync(Guid eventId, Guid memberId,
        CloseEventRegistrationRequest request, string? idempotencyKey, CancellationToken ct);
    Task<AppResult<EventLifecycleDto>> ConfirmExecutionAsync(Guid eventId, Guid memberId,
        ConfirmEventExecutionRequest request, string? idempotencyKey, CancellationToken ct);
}
