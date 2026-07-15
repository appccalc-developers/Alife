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
    private const int MaxCardImageUrlLength = 1200;

    public async Task<AppResult<PagePublicationReviewActionDto>> Handle(
        ApprovePagePublicationCommand request,
        CancellationToken cancellationToken)
    {
        if (!await AdminPlatformRoleHelpers.CanReviewPagesAsync(dbContext, request.CurrentMemberId, cancellationToken))
        {
            return AppResult<PagePublicationReviewActionDto>.Forbidden("Page reviewer access is required.");
        }

        var page = await dbContext.Pages.FirstOrDefaultAsync(x => x.Id == request.PageId, cancellationToken);
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
        var primaryMenuName = NormalizePrimaryMenuName(request.PrimaryMenuName);
        if (primaryMenuName is null)
        {
            return AppResult<PagePublicationReviewActionDto>.Validation("English and Chinese primary menu names are required.");
        }
        var accessName = NormalizeAccessName(request.AccessName, title);
        var cardText = NormalizeCardText(request.CardText, description, title);
        var cardImageUrl = NormalizeCardImageUrl(request.CardImageUrl);
        var review = await dbContext.PagePublicationReviews
            .FirstOrDefaultAsync(x => x.PageId == page.Id, cancellationToken);
        var previousStatus = review?.Status.ToString() ?? "Pending";

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

        review.Status = PagePublicationReviewStatus.Approved;
        review.PrimaryMenuNameJson = WriteTextMap(primaryMenuName);
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
                primaryMenuName,
                accessName,
                cardImageUrl,
                cardText,
                pageUpdatedUtc = page.UpdatedUtc
            }),
            MetadataJson = JsonSerializer.Serialize(new { ownerGroupId, pageUpdatedUtc = page.UpdatedUtc, primaryMenuName, accessName, cardImageUrl, cardText }),
            OccurredUtc = now
        }, cancellationToken);

        await dbContext.SaveChangesAsync(cancellationToken);
        await pageCacheInvalidationService.RemoveDetailAsync(page.Id, cancellationToken);
        await pageCacheInvalidationService.RemoveGroupPagesAsync(ownerGroupId, cancellationToken);

        return AppResult<PagePublicationReviewActionDto>.Success(new PagePublicationReviewActionDto(
            true,
            page.Id,
            ownerGroupId,
            ToDto(page, primaryMenuName, accessName, cardImageUrl, cardText)));
    }

    private static PageDto ToDto(
        Page page,
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
            PrimaryMenuName: primaryMenuName);

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
        IReadOnlyDictionary<string, string> title)
    {
        var fallbackEn = ReadTextValue(title, "en") ?? ReadTextValue(title, "zh") ?? "Untitled page";
        var fallbackZh = ReadTextValue(title, "zh") ?? ReadTextValue(title, "en") ?? fallbackEn;
        return new Dictionary<string, string>
        {
            ["en"] = ReadTextValue(value, "en") ?? fallbackEn,
            ["zh"] = ReadTextValue(value, "zh") ?? fallbackZh
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

    private static string? NormalizeCardImageUrl(string? value)
    {
        var text = value?.Trim();
        if (string.IsNullOrWhiteSpace(text))
        {
            return null;
        }

        return text.Length <= MaxCardImageUrlLength ? text : text[..MaxCardImageUrlLength];
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
