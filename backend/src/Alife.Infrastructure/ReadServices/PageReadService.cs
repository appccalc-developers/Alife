using Alife.Application.Pages.Dtos;
using Alife.Application.Pages.Services;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Hybrid;
using System.Text.Json;

namespace Alife.Infrastructure.ReadServices;

public sealed class PageReadService(AlifeDbContext dbContext, HybridCache hybridCache) : IPageReadService
{
    public Task<IReadOnlyList<PageDto>> GetGlobalPagesAsync(CancellationToken cancellationToken)
        => GetOrCreateAsync(
            PageCacheKeys.Global(),
            async token =>
            {
                var pages = await dbContext.Pages
                    .AsNoTracking()
                    .Where(x => x.Scope == PageScope.Global && x.Visibility == PageVisibility.Public)
                    .OrderBy(x => x.UpdatedUtc)
                    .ToListAsync(token);

                return (IReadOnlyList<PageDto>)pages.Select(ToDto).ToList();
            },
            cancellationToken);

    public Task<IReadOnlyList<PageDto>> GetPublicPagesAsync(CancellationToken cancellationToken)
        => GetOrCreateAsync(
            PageCacheKeys.Public(),
            async token =>
            {
                var pages = await dbContext.Pages
                    .AsNoTracking()
                    .Where(x =>
                        x.Visibility == PageVisibility.Public &&
                        (x.Scope == PageScope.Global ||
                         (x.Scope == PageScope.Group && x.OwnerGroup != null && x.OwnerGroup.IsChurch)))
                    .OrderBy(x => x.UpdatedUtc)
                    .ThenBy(x => x.Id)
                    .ToListAsync(token);

                return (IReadOnlyList<PageDto>)pages.Select(ToDto).ToList();
            },
            cancellationToken);

    public Task<PageDetailDto?> GetByIdAsync(Guid pageId, CancellationToken cancellationToken)
        => GetOrCreateAsync(
            PageCacheKeys.Detail(pageId),
            async token =>
            {
                var page = await dbContext.Pages
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x => x.Id == pageId, token);

                if (page is null)
                {
                    return null;
                }

                var sections = await dbContext.Sections
                    .AsNoTracking()
                    .Where(x => x.PageId == pageId)
                    .OrderBy(x => x.Order)
                    .Select(x => new PageSectionDto(x.Id, x.Order, x.Type, x.ContentJson, x.StyleJson))
                    .ToListAsync(token);

                return new PageDetailDto(
                    page.Id,
                    page.Scope,
                    page.OwnerGroupId,
                    page.CreatedByMemberId,
                    ReadTextMap(page.TitleJson),
                    ReadTextMap(page.DescriptionJson),
                    page.TagsJson,
                    page.TitleDisplayStyle,
                    page.Visibility,
                    page.UpdatedUtc,
                    sections);
            },
            cancellationToken);

    public Task<IReadOnlyList<PageDto>> GetGroupPagesAsync(Guid groupId, CancellationToken cancellationToken)
        => GetOrCreateAsync(
            PageCacheKeys.GroupPages(groupId),
            async token =>
            {
                var pages = await dbContext.Pages
                    .AsNoTracking()
                    .Where(x => x.Scope == PageScope.Group && x.OwnerGroupId == groupId)
                    .OrderByDescending(x => x.UpdatedUtc)
                    .ToListAsync(token);

                return (IReadOnlyList<PageDto>)pages.Select(ToDto).ToList();
            },
            cancellationToken);

    private static PageDto ToDto(Domain.Entities.Page page)
        => new(
            page.Id,
            page.Scope,
            page.OwnerGroupId,
            page.CreatedByMemberId,
            ReadTextMap(page.TitleJson),
            ReadTextMap(page.DescriptionJson),
            page.TagsJson,
            page.TitleDisplayStyle,
            page.Visibility,
            page.UpdatedUtc);

    private static IReadOnlyDictionary<string, string> ReadTextMap(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return new Dictionary<string, string>();
        }

        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, string>>(value) ?? new Dictionary<string, string>();
        }
        catch
        {
            return new Dictionary<string, string> { ["en"] = value };
        }
    }

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
