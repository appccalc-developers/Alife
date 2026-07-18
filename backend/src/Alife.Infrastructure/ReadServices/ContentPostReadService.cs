using Alife.Application.ContentPosts;
using Alife.Application.ContentPosts.Dtos;
using Alife.Application.ContentPosts.Services;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Hybrid;

namespace Alife.Infrastructure.ReadServices;

public sealed class ContentPostReadService(
    AlifeDbContext dbContext,
    HybridCache hybridCache) : IContentPostReadService
{
    private static readonly HybridCacheEntryOptions CacheOptions = new()
    {
        Expiration = TimeSpan.FromHours(24),
        LocalCacheExpiration = TimeSpan.FromMinutes(5)
    };

    public Task<IReadOnlyList<ContentPostSummaryDto>> GetPublicIndexAsync(
        Guid groupId,
        CancellationToken cancellationToken = default)
        => hybridCache.GetOrCreateAsync(
                ContentPostCacheKeys.PublicIndex(groupId),
                async token =>
                {
                    var now = DateTime.UtcNow;
                    var posts = await dbContext.ContentPosts
                        .AsNoTracking()
                        .Where(x =>
                            x.OwnerGroupId == groupId &&
                            x.Status == ContentPostStatus.Published &&
                            x.Visibility == ContentPostVisibility.Public &&
                            x.PublishedUtc != null &&
                            x.PublishedUtc <= now)
                        .OrderByDescending(x => x.PublishedUtc)
                        .ThenByDescending(x => x.UpdatedUtc)
                        .ToListAsync(token);

                    return (IReadOnlyList<ContentPostSummaryDto>)posts
                        .Select(ContentPostMapper.ToSummaryDto)
                        .ToList();
                },
                CacheOptions,
                cancellationToken: cancellationToken)
            .AsTask();

    public Task<ContentPostDetailDto?> GetPublicDetailAsync(
        Guid groupId,
        string slug,
        CancellationToken cancellationToken = default)
    {
        var normalizedSlug = slug.Trim().ToLowerInvariant();
        return hybridCache.GetOrCreateAsync(
                ContentPostCacheKeys.PublicDetail(groupId, normalizedSlug),
                async token =>
                {
                    var now = DateTime.UtcNow;
                    var post = await dbContext.ContentPosts
                        .AsNoTracking()
                        .FirstOrDefaultAsync(
                            x =>
                                x.OwnerGroupId == groupId &&
                                x.Slug == normalizedSlug &&
                                x.Status == ContentPostStatus.Published &&
                                x.Visibility == ContentPostVisibility.Public &&
                                x.PublishedUtc != null &&
                                x.PublishedUtc <= now,
                            token);

                    return post is null ? null : ContentPostMapper.ToDetailDto(post);
                },
                CacheOptions,
                cancellationToken: cancellationToken)
            .AsTask();
    }
}
