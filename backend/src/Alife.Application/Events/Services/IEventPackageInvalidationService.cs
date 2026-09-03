using Alife.Domain.Entities;

namespace Alife.Application.Events.Services;

public interface IEventPackageInvalidationService
{
    Task<EventPackageInvalidationResult> InvalidateForMaterialChangeAsync(
        GroupEvent groupEvent,
        Guid actorMemberId,
        string changeCode,
        string classification,
        CancellationToken cancellationToken = default);

    Task<EventPackageInvalidationResult> InvalidateForModuleChangeAsync(
        GroupEvent groupEvent,
        Guid actorMemberId,
        string moduleCode,
        string changeCode,
        string classification,
        CancellationToken cancellationToken = default);

    Task<EventPackageInvalidationResult> InvalidateForOccurrenceModuleChangeAsync(
        GroupEvent groupEvent,
        Guid occurrenceId,
        Guid actorMemberId,
        string moduleCode,
        string changeCode,
        string classification,
        CancellationToken cancellationToken = default);
}

public sealed record EventPackageInvalidationResult(
    int InvalidatedPackageCount,
    bool PublicationWithdrawn,
    bool RegistrationPaused,
    bool ExecutionBlocked,
    bool LocalReviewRequired = false)
{
    public bool Changed => InvalidatedPackageCount > 0 || PublicationWithdrawn || RegistrationPaused || ExecutionBlocked || LocalReviewRequired;
}
