using Alife.Application.Pages.Dtos;
using Alife.Application.Pages.Services;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Hybrid;
using System.Text.Json;

namespace Alife.Infrastructure.ReadServices;

public sealed class PageReadService(
    AlifeDbContext dbContext,
    HybridCache hybridCache,
    IHttpContextAccessor? httpContextAccessor = null) : IPageReadService
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
                          review.Status == PagePublicationReviewStatus.Approved &&
                          review.PrimaryMenuId != null
                    orderby (review.PrimaryMenu != null ? review.PrimaryMenu.SortOrder : int.MaxValue),
                        review.MenuSortOrder,
                        page.Id
                    select new
                    {
                        Page = page,
                        review.AccessNameJson,
                        review.CardImageUrl,
                        review.CardTextJson,
                        PrimaryMenuNameJson = review.PrimaryMenu != null ? review.PrimaryMenu.NameJson : review.PrimaryMenuNameJson,
                        review.PrimaryMenuId,
                        PrimaryMenuSortOrder = review.PrimaryMenu != null ? review.PrimaryMenu.SortOrder : 0,
                        PrimaryMenuHomePlacement = review.PrimaryMenu != null ? review.PrimaryMenu.HomePlacement : null,
                        review.MenuSortOrder
                    })
                    .ToListAsync(token);

                return (IReadOnlyList<PageDto>)pages
                    .Select(row => ToDto(
                        row.Page,
                        ReadNullableTextMap(row.AccessNameJson),
                        row.CardImageUrl,
                        ReadNullableTextMap(row.CardTextJson),
                        ReadNullableTextMap(row.PrimaryMenuNameJson),
                        row.PrimaryMenuId,
                        row.PrimaryMenuSortOrder,
                        row.MenuSortOrder,
                        row.PrimaryMenuHomePlacement))
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

                var pageIds = pages.Select(x => x.Id).ToList();
                var reviewsList = await dbContext.PagePublicationReviews
                    .AsNoTracking()
                    .Include(x => x.PrimaryMenu)
                    .Where(x => pageIds.Contains(x.PageId))
                    .ToListAsync(token);

                var reviews = reviewsList
                    .GroupBy(x => x.PageId)
                    .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.UpdatedUtc).First());

                return (IReadOnlyList<PageDto>)pages
                    .Select(page =>
                    {
                        reviews.TryGetValue(page.Id, out var review);
                        return ToDto(
                            page,
                            ReadNullableTextMap(review?.AccessNameJson),
                            review?.CardImageUrl,
                            ReadNullableTextMap(review?.CardTextJson),
                            ReadNullableTextMap(review?.PrimaryMenu?.NameJson ?? review?.PrimaryMenuNameJson),
                            review?.PrimaryMenuId,
                            review?.PrimaryMenu?.SortOrder ?? 0,
                            review?.MenuSortOrder ?? 0,
                            review?.PrimaryMenu?.HomePlacement);
                    })
                    .ToList();
            },
            cancellationToken);

    private static PageDto ToDto(Domain.Entities.Page page)
        => ToDto(page, null, null, null, null, null, 0, 0, null);

    private static PageDto ToDto(
        Domain.Entities.Page page,
        IReadOnlyDictionary<string, string>? accessName,
        string? cardImageUrl,
        IReadOnlyDictionary<string, string>? cardText,
        IReadOnlyDictionary<string, string>? primaryMenuName,
        Guid? primaryMenuId,
        int primaryMenuSortOrder,
        int menuSortOrder,
        PagePrimaryMenuHomePlacement? primaryMenuHomePlacement)
    {
        return new PageDto(
            page.Id,
            page.OwnerGroupId,
            page.CreatedByMemberId,
            ReadTextMap(page.TitleJson),
            ReadTextMap(page.DescriptionJson),
            page.TagsJson,
            page.TitleDisplayStyle,
            page.Visibility,
            page.UpdatedUtc,
            AccessName: accessName,
            ReviewRefusal: null,
            CardImageUrl: cardImageUrl,
            CardText: cardText,
            PrimaryMenuName: primaryMenuName,
            PrimaryMenuId: primaryMenuId,
            PrimaryMenuSortOrder: primaryMenuSortOrder,
            MenuSortOrder: menuSortOrder,
            PrimaryMenuHomePlacement: primaryMenuHomePlacement);
    }

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
