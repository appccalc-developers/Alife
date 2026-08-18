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
    public Task<IReadOnlyList<GroupEventSummaryDto>> GetGroupEventsAsync(Guid groupId, CancellationToken cancellationToken)
        => GetOrCreateAsync(
            EventCacheKeys.GroupEvents(groupId),
            async token =>
            {
                var events = await dbContext.GroupEvents
                    .AsNoTracking()
                    .Include(e => e.ContactProfiles)
                    .Include(e => e.RamAssessment)
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
                    Alife.Application.Events.Services.EventVisibilityPolicy.ReadVisibility(e.EventDataJson)
                )).ToList();

                return (IReadOnlyList<GroupEventSummaryDto>)dtos;
            },
            cancellationToken);

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
                    .Where(e => e.EndDate >= fromUtc &&
                        e.RamAssessment != null &&
                        e.RamAssessment.Status == Alife.Domain.Enums.EventRamStatus.Approved)
                    .OrderBy(e => e.StartDate)
                    .Take(200)
                    .ToListAsync(token);

                return candidates
                    .Where(e => Alife.Application.Events.Services.EventVisibilityPolicy.ReadVisibility(e.EventDataJson) ==
                        Alife.Application.Events.Services.EventVisibilityPolicy.Public)
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

        return events.Take(Math.Clamp(limit, 1, 50)).ToList();
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
