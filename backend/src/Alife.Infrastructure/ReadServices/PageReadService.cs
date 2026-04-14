using Alife.Application.Pages.Dtos;
using Alife.Application.Pages.Services;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Hybrid;

namespace Alife.Infrastructure.ReadServices;

public sealed class PageReadService(AlifeDbContext dbContext, HybridCache hybridCache) : IPageReadService
{
    public Task<IReadOnlyList<PageDto>> GetGlobalPagesAsync(string lang, CancellationToken cancellationToken)
        => GetOrCreateAsync(
            PageCacheKeys.Global(lang),
            async token =>
            {
                var pages = await dbContext.Pages
                    .AsNoTracking()
                    .Where(x => x.Scope == PageScope.Global && x.Language == lang)
                    .OrderBy(x => x.Title)
                    .Select(ToDto())
                    .ToListAsync(token);

                return (IReadOnlyList<PageDto>)pages;
            },
            cancellationToken);

    public Task<PageDto?> GetBySlugAsync(string slug, string lang, CancellationToken cancellationToken)
        => GetOrCreateAsync(
            PageCacheKeys.BySlug(slug, lang),
            async token => await dbContext.Pages
                .AsNoTracking()
                .OrderBy(x => x.Scope)
                .Where(x => x.Slug == slug && x.Language == lang)
                .Select(ToDto())
                .FirstOrDefaultAsync(token),
            cancellationToken);

    public Task<IReadOnlyList<PageDto>> GetGroupPagesAsync(Guid groupId, string lang, CancellationToken cancellationToken)
        => GetOrCreateAsync(
            PageCacheKeys.GroupPages(groupId, lang),
            async token =>
            {
                var pages = await dbContext.Pages
                    .AsNoTracking()
                    .Where(x => x.Scope == PageScope.Group && x.OwnerGroupId == groupId && x.Language == lang)
                    .OrderByDescending(x => x.UpdatedUtc)
                    .Select(ToDto())
                    .ToListAsync(token);

                return (IReadOnlyList<PageDto>)pages;
            },
            cancellationToken);

    private static System.Linq.Expressions.Expression<Func<Domain.Entities.Page, PageDto>> ToDto()
        => x => new PageDto(
            x.Id,
            x.Scope,
            x.OwnerGroupId,
            x.CreatedByMemberId,
            x.Title,
            x.Description,
            x.TagsJson,
            x.TitleDisplayStyle,
            x.Slug,
            x.Language,
            x.Visibility,
            x.UpdatedUtc);

    private Task<T> GetOrCreateAsync<T>(
        string cacheKey,
        Func<CancellationToken, Task<T>> factory,
        CancellationToken cancellationToken)
    {
        return hybridCache.GetOrCreateAsync(
                cacheKey,
                async token => await factory(token),
                new HybridCacheEntryOptions
                {
                    Expiration = TimeSpan.FromMinutes(5),
                    LocalCacheExpiration = TimeSpan.FromMinutes(2)
                },
                cancellationToken: cancellationToken)
            .AsTask();
    }
}
