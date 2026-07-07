using Alife.Application.Common.Models;
using Alife.Application.Sermons.Dtos;
using Alife.Application.Sermons.Services;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Hybrid;

namespace Alife.Infrastructure.ReadServices;

public sealed class SermonReadService(AlifeDbContext dbContext, HybridCache hybridCache) : ISermonReadService
{
    public Task<SermonDto?> GetSermonByIdAsync(Guid sermonId, CancellationToken cancellationToken)
        => dbContext.Sermons
            .AsNoTracking()
            .Where(x => x.Id == sermonId)
            .Select(x => new SermonDto(
                x.Id,
                x.Title,
                x.SpeakerName,
                x.ThumbnailUrl,
                !string.IsNullOrEmpty(x.VideoUrl)
                    ? x.VideoUrl
                    : !string.IsNullOrEmpty(x.YoutubeVideoId)
                        ? "https://www.youtube.com/watch?v=" + x.YoutubeVideoId
                        : null,
                x.PreachedAtUtc))
            .FirstOrDefaultAsync(cancellationToken);

    public Task<PagedResult<SermonDto>> GetSermonsAsync(int page, int pageSize, CancellationToken cancellationToken)
    {
        var normalizedPage = Math.Max(1, page);
        var normalizedPageSize = Math.Clamp(pageSize, 1, 30);

        return GetSermonsPageAsync(normalizedPage, normalizedPageSize, cancellationToken);
    }

    private async Task<PagedResult<SermonDto>> GetSermonsPageAsync(int page, int pageSize, CancellationToken cancellationToken)
    {
        var orderedQuery = dbContext.Sermons
            .AsNoTracking()
            .OrderBy(x => x.PreachedAtUtc == null)
            .ThenByDescending(x => x.PreachedAtUtc)
            .ThenBy(x => x.SortOrder);

        var totalCount = await orderedQuery.CountAsync(cancellationToken);
        var sermons = await orderedQuery
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new SermonDto(
                x.Id,
                x.Title,
                x.SpeakerName,
                x.ThumbnailUrl,
                !string.IsNullOrEmpty(x.VideoUrl)
                    ? x.VideoUrl
                    : !string.IsNullOrEmpty(x.YoutubeVideoId)
                        ? "https://www.youtube.com/watch?v=" + x.YoutubeVideoId
                        : null,
                x.PreachedAtUtc))
            .ToListAsync(cancellationToken);

        return new PagedResult<SermonDto>(sermons, page, pageSize, totalCount);
    }

    public Task<IReadOnlyList<SermonDto>> GetAllSermonsAsync(CancellationToken cancellationToken)
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
                            !string.IsNullOrEmpty(x.VideoUrl)
                                ? x.VideoUrl
                                : !string.IsNullOrEmpty(x.YoutubeVideoId)
                                    ? "https://www.youtube.com/watch?v=" + x.YoutubeVideoId
                                    : null,
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
