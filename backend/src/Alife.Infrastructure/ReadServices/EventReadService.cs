using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Hybrid;

namespace Alife.Infrastructure.ReadServices;

public sealed class EventReadService(
    AlifeDbContext dbContext,
    HybridCache hybridCache,
    IHttpContextAccessor? httpContextAccessor = null) : IEventReadService
{
    public async Task<IReadOnlyList<GroupEventSummaryDto>> GetGroupEventsAsync(Guid groupId, CancellationToken cancellationToken)
    {
        var cached = await GetOrCreateAsync(
            EventCacheKeys.GroupEvents(groupId),
            async token =>
            {
                var events = await dbContext.GroupEvents
                    .AsNoTracking()
                    .Include(e => e.ContactProfiles)
                    .Include(e => e.RamAssessment)
                    .Include(e => e.PublishedPackage).ThenInclude(package => package!.Conditions)
                    .Include(e => e.PublishedPackage).ThenInclude(package => package!.Decisions)
                    .Where(e => e.GroupId == groupId)
                    .OrderBy(e => e.StartDate)
                    .ToListAsync(token);

                var dtos = events.Select(e => new GroupEventSummaryDto(
                    e.Id,
                    e.GroupId,
                    e.CreatedByMemberId,
                    e.TitleEn,
                    e.TitleZh,
                    e.StartDate,
                    e.EndDate,
                    e.EventDataJson,
                    e.CreatedUtc,
                    e.UpdatedUtc,
                    e.ContactProfiles?.Select(x => x.ContactProfileId).ToList() ?? new List<Guid>(),
                    e.RamAssessment?.Status ?? Alife.Domain.Enums.EventRamStatus.Draft,
                    Alife.Application.Events.Services.EventVisibilityPolicy.ReadVisibility(e.EventDataJson),
                    e.AccountableOwnerMemberId,
                    e.GovernanceMode,
                    e.SponsorshipStatus,
                    e.ActivePlanVersion,
                    e.PublicationStatus,
                    PublicationGateSatisfied(e, DateTime.UtcNow),
                    e.PublishedPackageId,
                    e.PublishedUtc
                )).ToList();

                return (IReadOnlyList<GroupEventSummaryDto>)dtos;
            },
            cancellationToken);
        if (cached.Count == 0) return cached;

        // The group list is shared and may outlive a condition or approval deadline. Keep the
        // expensive presentation projection cached, but always refresh the security/lifecycle
        // dimensions that decide whether downstream church-life views may expose the Event.
        var ids = cached.Select(x => x.Id).ToArray();
        var current = await dbContext.GroupEvents.AsNoTracking()
            .Include(e => e.RamAssessment)
            .Include(e => e.PublishedPackage).ThenInclude(package => package!.Conditions)
            .Include(e => e.PublishedPackage).ThenInclude(package => package!.Decisions)
            .Where(e => ids.Contains(e.Id)).ToDictionaryAsync(e => e.Id, cancellationToken);
        var now = DateTime.UtcNow;
        return cached.Where(x => current.ContainsKey(x.Id)).Select(value =>
        {
            var entity = current[value.Id];
            return value with
            {
                RamStatus = entity.RamAssessment?.Status ?? Alife.Domain.Enums.EventRamStatus.Draft,
                GovernanceMode = entity.GovernanceMode,
                SponsorshipStatus = entity.SponsorshipStatus,
                PublicationStatus = entity.PublicationStatus,
                PublicationGateSatisfied = PublicationGateSatisfied(entity, now),
                PublishedPackageId = entity.PublishedPackageId,
                PublishedUtc = entity.PublishedUtc
            };
        }).ToList();
    }

    public async Task<IReadOnlyList<PublicEventSummaryDto>> GetPublicUpcomingEventsAsync(
        DateTime fromUtc,
        int limit,
        CancellationToken cancellationToken)
    {
        var events = await GetOrCreateAsync(
            EventCacheKeys.PublicUpcomingEvents(),
            async token =>
            {
                var candidates = await dbContext.GroupEvents
                    .AsNoTracking()
                    .Include(e => e.RamAssessment)
                    .Include(e => e.PublishedPackage).ThenInclude(package => package!.Conditions)
                    .Include(e => e.PublishedPackage).ThenInclude(package => package!.Decisions)
                    .Where(e => e.EndDate >= fromUtc &&
                        e.RamAssessment != null &&
                        e.RamAssessment.Status == Alife.Domain.Enums.EventRamStatus.Approved)
                    .OrderBy(e => e.StartDate)
                    .Take(200)
                    .ToListAsync(token);

                return candidates
                    .Where(e => Alife.Application.Events.Services.EventVisibilityPolicy.ReadVisibility(e.EventDataJson) ==
                        Alife.Application.Events.Services.EventVisibilityPolicy.Public)
                    .Where(e => e.GovernanceMode != Alife.Domain.Enums.EventGovernanceMode.ChurchSponsored ||
                        e.SponsorshipStatus == Alife.Domain.Enums.EventSponsorshipStatus.Approved)
                    .Where(e => e.PublicationStatus == Alife.Domain.Enums.EventPublicationStatus.LegacyImplicit ||
                        e.PublicationStatus == Alife.Domain.Enums.EventPublicationStatus.Published && PublicationGateSatisfied(e, DateTime.UtcNow))
                    .Take(50)
                    .Select(e => new PublicEventSummaryDto(
                        e.Id,
                        e.GroupId,
                        e.TitleEn,
                        e.TitleZh,
                        e.StartDate,
                        e.EndDate,
                        Alife.Application.Events.Services.EventVisibilityPolicy.CreatePublicEventDataJson(e.EventDataJson),
                        Alife.Application.Events.Services.EventVisibilityPolicy.Public))
                    .ToList();
            },
            cancellationToken);

        if (events.Count == 0) return [];

        // The shared projection may outlive a condition deadline. Re-check the small cached ID set
        // against authoritative lifecycle state on every request so stale cache can never keep an
        // expired, revoked, unpublished, or sponsorship-blocked Event public.
        var candidateIds = events.Select(x => x.Id).ToArray();
        var currentStates = await dbContext.GroupEvents.AsNoTracking()
            .Include(e => e.RamAssessment)
            .Include(e => e.PublishedPackage).ThenInclude(package => package!.Conditions)
            .Include(e => e.PublishedPackage).ThenInclude(package => package!.Decisions)
            .Where(e => candidateIds.Contains(e.Id)).ToListAsync(cancellationToken);
        var now = DateTime.UtcNow;
        var currentlyPublic = currentStates.Where(e =>
                e.RamAssessment?.Status == Alife.Domain.Enums.EventRamStatus.Approved &&
                (e.GovernanceMode != Alife.Domain.Enums.EventGovernanceMode.ChurchSponsored ||
                 e.SponsorshipStatus == Alife.Domain.Enums.EventSponsorshipStatus.Approved) &&
                (e.PublicationStatus == Alife.Domain.Enums.EventPublicationStatus.LegacyImplicit ||
                 e.PublicationStatus == Alife.Domain.Enums.EventPublicationStatus.Published && PublicationGateSatisfied(e, now)))
            .Select(e => e.Id).ToHashSet();
        return events.Where(x => currentlyPublic.Contains(x.Id))
            .Take(Math.Clamp(limit, 1, 50)).ToList();
    }

    private static bool PublicationGateSatisfied(Alife.Domain.Entities.GroupEvent groupEvent, DateTime now)
    {
        if (groupEvent.PublicationStatus == Alife.Domain.Enums.EventPublicationStatus.LegacyImplicit) return true;
        if (groupEvent.PublicationStatus != Alife.Domain.Enums.EventPublicationStatus.Published) return false;
        return EventPackageGateEvaluator.Evaluate(Alife.Domain.Enums.EventLifecycleGate.Publish,
            groupEvent.PublicationGateMode, groupEvent.PublishedPackage, now).Allowed;
    }

    private async Task<T> GetOrCreateAsync<T>(
        string cacheKey,
        Func<CancellationToken, Task<T>> factory,
        CancellationToken cancellationToken)
    {
        var isMiss = false;
        var result = await hybridCache.GetOrCreateAsync(
                cacheKey,
                async token =>
                {
                    isMiss = true;
                    return await factory(token);
                },
                new HybridCacheEntryOptions
                {
                    Expiration = TimeSpan.FromMinutes(5),
                    LocalCacheExpiration = TimeSpan.FromMinutes(2)
                },
                cancellationToken: cancellationToken)
            .AsTask();

        var response = httpContextAccessor?.HttpContext?.Response;
        if (response != null && !response.HasStarted)
        {
            response.Headers["x-alife-backend-cache"] = isMiss ? "MISS" : "HIT";
        }

        return result;
    }
}
