using Alife.Application.Sermons.Dtos;
using Alife.Application.Sermons.Services;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Hybrid;

namespace Alife.Infrastructure.ReadServices;

public sealed class SermonReadService(AlifeDbContext dbContext, HybridCache hybridCache) : ISermonReadService
{
    public Task<IReadOnlyList<SermonDto>> GetSermonsAsync(CancellationToken cancellationToken)
        => hybridCache.GetOrCreateAsync(
                SermonCacheKeys.All(),
                async token =>
                {
                    var sermons = await dbContext.Sermons
                        .AsNoTracking()
                        .OrderBy(x => x.PreachedAtUtc == null)
                        .ThenByDescending(x => x.PreachedAtUtc)
                        .ThenBy(x => x.SortOrder)
                        .Select(x => new SermonDto(
                            x.Id,
                            x.Title,
                            x.SpeakerName,
                            x.ThumbnailUrl,
                            x.VideoUrl,
                            x.PreachedAtUtc))
                        .ToListAsync(token);

                    return (IReadOnlyList<SermonDto>)sermons;
                },
                new HybridCacheEntryOptions
                {
                    Expiration = TimeSpan.FromMinutes(15),
                    LocalCacheExpiration = TimeSpan.FromMinutes(5)
                },
                cancellationToken: cancellationToken)
            .AsTask();
}
