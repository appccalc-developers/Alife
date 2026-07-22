using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Hybrid;

namespace Alife.Infrastructure.ReadServices;

public sealed class EventReadService(AlifeDbContext dbContext, HybridCache hybridCache) : IEventReadService
{
    public Task<IReadOnlyList<GroupEventSummaryDto>> GetGroupEventsAsync(Guid groupId, CancellationToken cancellationToken)
        => hybridCache.GetOrCreateAsync(
                EventCacheKeys.GroupEvents(groupId),
                async token =>
                {
                    var events = await dbContext.GroupEvents
                        .AsNoTracking()
                        .Where(e => e.GroupId == groupId)
                        .OrderBy(e => e.StartDate)
                        .Select(e => new GroupEventSummaryDto(
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
                            e.ContactProfiles.Select(x => x.ContactProfileId).ToList(),
                            e.RamAssessment == null ? Alife.Domain.Enums.EventRamStatus.Draft : e.RamAssessment.Status))
                        .ToListAsync(token);

                    return (IReadOnlyList<GroupEventSummaryDto>)events;
                },
                new HybridCacheEntryOptions
                {
                    Expiration = TimeSpan.FromMinutes(5),
                    LocalCacheExpiration = TimeSpan.FromMinutes(2)
                },
                cancellationToken: cancellationToken)
            .AsTask();
}
