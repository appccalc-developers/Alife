using Alife.Application.ContentPosts;
using Alife.Application.ContentPosts.Dtos;
using Alife.Application.ContentPosts.Services;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Hybrid;

namespace Alife.Infrastructure.ReadServices;

public sealed class ContentPostReadService(
    AlifeDbContext dbContext,
    HybridCache hybridCache,
    IHttpContextAccessor? httpContextAccessor = null) : IContentPostReadService
{
    private static readonly HybridCacheEntryOptions CacheOptions = new()
    {
        Expiration = TimeSpan.FromHours(24),
        LocalCacheExpiration = TimeSpan.FromMinutes(5)
    };

    public Task<IReadOnlyList<ContentPostSummaryDto>> GetPublicIndexAsync(
        Guid groupId,
        CancellationToken cancellationToken = default)
        => GetOrCreateAsync(
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
            cancellationToken);

    public Task<ContentPostDetailDto?> GetPublicDetailAsync(
        Guid groupId,
        string slug,
        CancellationToken cancellationToken = default)
    {
        var normalizedSlug = slug.Trim().ToLowerInvariant();
        return GetOrCreateAsync(
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
            cancellationToken);
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
                CacheOptions,
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
