using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Pages.Dtos;
using Alife.Application.Pages.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Alife.Application.Admin.Commands.ApprovePagePublication;

public sealed class ApprovePagePublicationCommandHandler(
    IAlifeDbContext dbContext,
    IPageCacheInvalidationService pageCacheInvalidationService)
    : IRequestHandler<ApprovePagePublicationCommand, AppResult<PagePublicationReviewActionDto>>
{
    public async Task<AppResult<PagePublicationReviewActionDto>> Handle(
        ApprovePagePublicationCommand request,
        CancellationToken cancellationToken)
    {
        if (!await AdminPlatformRoleHelpers.CanReviewPagesAsync(dbContext, request.CurrentMemberId, cancellationToken))
        {
            return AppResult<PagePublicationReviewActionDto>.Forbidden("Page reviewer access is required.");
        }

        var page = await dbContext.Pages
            .Include(x => x.OwnerGroup)
            .Include(x => x.Sections)
                .ThenInclude(x => x.Links)
            .FirstOrDefaultAsync(x => x.Id == request.PageId, cancellationToken);
        if (page is null)
        {
            return AppResult<PagePublicationReviewActionDto>.NotFound("Page was not found.");
        }

        if (page.Visibility != PageVisibility.Public)
        {
            return AppResult<PagePublicationReviewActionDto>.Conflict("Only public pages can be approved for publication.");
        }

        var now = DateTime.UtcNow;
        var ownerGroupId = page.OwnerGroupId;
        var title = ReadTextMap(page.TitleJson);
        var description = ReadTextMap(page.DescriptionJson);
        var ownerGroupName = ReadTextMap(page.OwnerGroup?.NameJson);
        var accessName = NormalizeAccessName(request.AccessName, ownerGroupName, title);
        var cardText = NormalizeCardText(request.CardText, description, title);
        var cardImageUrl = PagePublicationReviewDefaults.ExtractFirstSectionImage(page.Sections);
        var review = await dbContext.PagePublicationReviews
            .FirstOrDefaultAsync(x => x.PageId == page.Id, cancellationToken);
        var previousStatus = review?.Status.ToString() ?? "Pending";
        var requestedPrimaryMenuName = request.PrimaryMenuName;
        if (requestedPrimaryMenuName is null && review?.Status == PagePublicationReviewStatus.Approved)
        {
            requestedPrimaryMenuName = ReadTextMap(review.PrimaryMenuNameJson);
        }

        var primaryMenuName = NormalizePrimaryMenuName(requestedPrimaryMenuName);
        if (primaryMenuName is null)
        {
            return AppResult<PagePublicationReviewActionDto>.Validation("English and Chinese primary menu names are required.");
        }

        var primaryMenuNameJson = WriteTextMap(primaryMenuName);
        var primaryMenu = review?.PrimaryMenuId is Guid existingPrimaryMenuId && request.PrimaryMenuName is null
            ? await dbContext.PagePrimaryMenus.FirstOrDefaultAsync(x => x.Id == existingPrimaryMenuId, cancellationToken)
            : await dbContext.PagePrimaryMenus
                .OrderBy(x => x.SortOrder)
                .FirstOrDefaultAsync(x => x.NameJson == primaryMenuNameJson, cancellationToken);

        if (primaryMenu is null)
        {
            var nextPrimaryMenuSortOrder = (await dbContext.PagePrimaryMenus
                .Select(x => (int?)x.SortOrder)
                .MaxAsync(cancellationToken) ?? -1) + 1;
            primaryMenu = new PagePrimaryMenu
            {
                Id = Guid.NewGuid(),
                NameJson = primaryMenuNameJson,
                SortOrder = nextPrimaryMenuSortOrder,
                CreatedUtc = now,
                UpdatedUtc = now
            };
            await dbContext.PagePrimaryMenus.AddAsync(primaryMenu, cancellationToken);
        }

        if (review is null)
        {
            review = new PagePublicationReview
            {
                Id = Guid.NewGuid(),
                PageId = page.Id,
                CreatedUtc = now
            };
            dbContext.PagePublicationReviews.Add(review);
        }

        if (review.PrimaryMenuId != primaryMenu.Id)
        {
            review.MenuSortOrder = (await dbContext.PagePublicationReviews
                .Where(x => x.PrimaryMenuId == primaryMenu.Id && x.Status == PagePublicationReviewStatus.Approved)
                .Select(x => (int?)x.MenuSortOrder)
                .MaxAsync(cancellationToken) ?? -1) + 1;
        }

        review.Status = PagePublicationReviewStatus.Approved;
        review.PrimaryMenuId = primaryMenu.Id;
        review.PrimaryMenuNameJson = primaryMenu.NameJson;
        review.AccessNameJson = WriteTextMap(accessName);
        review.CardImageUrl = cardImageUrl;
        review.CardTextJson = WriteTextMap(cardText);
        review.ReturnReason = null;
        review.ReviewedByMemberId = request.CurrentMemberId;
        review.ReviewedUtc = now;
        review.UpdatedUtc = now;

        await dbContext.AuditLogs.AddAsync(new AuditLog
        {
            Id = Guid.NewGuid(),
            ActorMemberId = request.CurrentMemberId,
            Action = PagePublicationReviewActions.Approve,
            EntityType = "page",
            EntityId = page.Id,
            GroupId = ownerGroupId,
            BeforeJson = JsonSerializer.Serialize(new
            {
                ownerGroupId,
                visibility = page.Visibility.ToString(),
                publicationReviewStatus = previousStatus,
                pageUpdatedUtc = page.UpdatedUtc
            }),
            AfterJson = JsonSerializer.Serialize(new
            {
                ownerGroupId,
                visibility = page.Visibility.ToString(),
                publicationReviewStatus = "Approved",
                primaryMenuId = primaryMenu.Id,
                primaryMenuName,
                accessName,
                cardImageUrl,
                cardText,
                pageUpdatedUtc = page.UpdatedUtc
            }),
            MetadataJson = JsonSerializer.Serialize(new { ownerGroupId, pageUpdatedUtc = page.UpdatedUtc, primaryMenuId = primaryMenu.Id, primaryMenuName, accessName, cardImageUrl, cardText }),
            OccurredUtc = now
        }, cancellationToken);

        await dbContext.SaveChangesAsync(cancellationToken);
        await pageCacheInvalidationService.RemoveDetailAsync(page.Id, cancellationToken);
        await pageCacheInvalidationService.RemoveGroupPagesAsync(ownerGroupId, cancellationToken);

        return AppResult<PagePublicationReviewActionDto>.Success(new PagePublicationReviewActionDto(
            true,
            page.Id,
            ownerGroupId,
            ToDto(page, primaryMenu, review.MenuSortOrder, primaryMenuName, accessName, cardImageUrl, cardText)));
    }

    private static PageDto ToDto(
        Page page,
        PagePrimaryMenu primaryMenu,
        int menuSortOrder,
        IReadOnlyDictionary<string, string> primaryMenuName,
        IReadOnlyDictionary<string, string> accessName,
        string? cardImageUrl,
        IReadOnlyDictionary<string, string> cardText)
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
            accessName,
            CardImageUrl: cardImageUrl,
            CardText: cardText,
            PrimaryMenuName: primaryMenuName,
            PrimaryMenuId: primaryMenu.Id,
            PrimaryMenuSortOrder: primaryMenu.SortOrder,
            MenuSortOrder: menuSortOrder,
            PrimaryMenuHomePlacement: primaryMenu.HomePlacement);

    private static IReadOnlyDictionary<string, string>? NormalizePrimaryMenuName(
        IReadOnlyDictionary<string, string>? value)
    {
        if (value is null || value.Count == 0)
        {
            return new Dictionary<string, string>
            {
                ["en"] = "Ministries",
                ["zh"] = "事工"
            };
        }

        var en = ReadTextValue(value, "en");
        var zh = ReadTextValue(value, "zh");
        if (en is null || zh is null)
        {
            return null;
        }

        return new Dictionary<string, string>
        {
            ["en"] = en.Length <= 120 ? en : en[..120],
            ["zh"] = zh.Length <= 120 ? zh : zh[..120]
        };
    }

    private static IReadOnlyDictionary<string, string> NormalizeAccessName(
        IReadOnlyDictionary<string, string>? value,
        IReadOnlyDictionary<string, string> ownerGroupName,
        IReadOnlyDictionary<string, string> title)
    {
        var fallback = PagePublicationReviewDefaults.CreateAccessName(ownerGroupName, title);
        return new Dictionary<string, string>
        {
            ["en"] = ReadTextValue(value, "en") ?? fallback["en"],
            ["zh"] = ReadTextValue(value, "zh") ?? fallback["zh"]
        };
    }

    private static IReadOnlyDictionary<string, string> NormalizeCardText(
        IReadOnlyDictionary<string, string>? value,
        IReadOnlyDictionary<string, string> description,
        IReadOnlyDictionary<string, string> title)
    {
        var fallbackEn = ReadTextValue(description, "en") ??
                         ReadTextValue(description, "zh") ??
                         ReadTextValue(title, "en") ??
                         ReadTextValue(title, "zh") ??
                         "Learn more about this ministry.";
        var fallbackZh = ReadTextValue(description, "zh") ??
                         ReadTextValue(description, "en") ??
                         ReadTextValue(title, "zh") ??
                         ReadTextValue(title, "en") ??
                         fallbackEn;
        return new Dictionary<string, string>
        {
            ["en"] = ReadTextValue(value, "en") ?? fallbackEn,
            ["zh"] = ReadTextValue(value, "zh") ?? fallbackZh
        };
    }

    private static string? ReadTextValue(IReadOnlyDictionary<string, string>? value, string key)
        => value is not null &&
           value.TryGetValue(key, out var text) &&
           !string.IsNullOrWhiteSpace(text)
            ? text.Trim()
            : null;

    private static string WriteTextMap(IReadOnlyDictionary<string, string> value)
        => JsonSerializer.Serialize(value);

    private static IReadOnlyDictionary<string, string> ReadTextMap(string? value)
        => string.IsNullOrWhiteSpace(value)
            ? new Dictionary<string, string>()
            : JsonSerializer.Deserialize<Dictionary<string, string>>(value) ?? new Dictionary<string, string>();
}
