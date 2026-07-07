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
    public Task<IReadOnlyList<PageDto>> GetPublicPagesAsync(CancellationToken cancellationToken)
        => GetOrCreateAsync(
            PageCacheKeys.Public(),
            async token =>
            {
                var pages = await (
                    from page in dbContext.Pages.AsNoTracking()
                    join review in dbContext.PagePublicationReviews.AsNoTracking()
                        on page.Id equals review.PageId into reviews
                    from review in reviews.DefaultIfEmpty()
                    where page.Visibility == PageVisibility.Public &&
                          review != null &&
                          review.Status == PagePublicationReviewStatus.Approved
                    orderby page.UpdatedUtc, page.Id
                    select new { Page = page, Review = review })
                    .ToListAsync(token);

                return (IReadOnlyList<PageDto>)pages
                    .Select(row => ToDto(row.Page, ReadNullableTextMap(row.Review?.AccessNameJson)))
                    .ToList();
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
                    .Where(x => x.OwnerGroupId == groupId)
                    .OrderByDescending(x => x.UpdatedUtc)
                    .ToListAsync(token);

                return (IReadOnlyList<PageDto>)pages.Select(ToDto).ToList();
            },
            cancellationToken);

    private static PageDto ToDto(Domain.Entities.Page page)
        => ToDto(page, null);

    private static PageDto ToDto(Domain.Entities.Page page, IReadOnlyDictionary<string, string>? accessName)
        => new(
            page.Id,
            page.OwnerGroupId,
            page.CreatedByMemberId,
            ReadTextMap(page.TitleJson),
            ReadTextMap(page.DescriptionJson),
            page.TagsJson,
            page.TitleDisplayStyle,
            page.Visibility,
            page.UpdatedUtc,
            accessName);

    private static IReadOnlyDictionary<string, string>? ReadNullableTextMap(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, string>>(value);
        }
        catch
        {
            return new Dictionary<string, string> { ["en"] = value };
        }
    }

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
