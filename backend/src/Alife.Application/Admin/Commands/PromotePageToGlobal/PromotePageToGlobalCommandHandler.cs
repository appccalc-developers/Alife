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

namespace Alife.Application.Admin.Commands.PromotePageToGlobal;

public sealed class PromotePageToGlobalCommandHandler(
    IAlifeDbContext dbContext,
    IPageCacheInvalidationService pageCacheInvalidationService)
    : IRequestHandler<PromotePageToGlobalCommand, AppResult<PageGlobalReviewActionDto>>
{
    public async Task<AppResult<PageGlobalReviewActionDto>> Handle(
        PromotePageToGlobalCommand request,
        CancellationToken cancellationToken)
    {
        if (!await AdminPlatformRoleHelpers.CanReviewPagesAsync(dbContext, request.CurrentMemberId, cancellationToken))
        {
            return AppResult<PageGlobalReviewActionDto>.Forbidden("Page reviewer access is required.");
        }

        var page = await dbContext.Pages.FirstOrDefaultAsync(x => x.Id == request.PageId, cancellationToken);
        if (page is null)
        {
            return AppResult<PageGlobalReviewActionDto>.NotFound("Page was not found.");
        }

        if (page.OwnerGroupId is null || page.Visibility != PageVisibility.Public)
        {
            return AppResult<PageGlobalReviewActionDto>.Conflict("Only public group pages can be approved for publication.");
        }

        var now = DateTime.UtcNow;
        var previousOwnerGroupId = page.OwnerGroupId.Value;
        var accessName = NormalizeAccessName(request.AccessName, ReadTextMap(page.TitleJson));
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
        review.AccessNameJson = WriteTextMap(accessName);
        review.ReturnReason = null;
        review.ReviewedByMemberId = request.CurrentMemberId;
        review.ReviewedUtc = now;
        review.UpdatedUtc = now;

        var before = new
        {
            ownerGroupId = page.OwnerGroupId,
            visibility = page.Visibility.ToString(),
            globalPublicationStatus = previousStatus,
            pageUpdatedUtc = page.UpdatedUtc
        };

        await dbContext.AuditLogs.AddAsync(new AuditLog
        {
            Id = Guid.NewGuid(),
            ActorMemberId = request.CurrentMemberId,
            Action = PageGlobalReviewActions.Approve,
            EntityType = "page",
            EntityId = page.Id,
            GroupId = previousOwnerGroupId,
            BeforeJson = JsonSerializer.Serialize(before),
            AfterJson = JsonSerializer.Serialize(new
            {
                ownerGroupId = page.OwnerGroupId,
                visibility = page.Visibility.ToString(),
                globalPublicationStatus = "Approved",
                accessName,
                pageUpdatedUtc = page.UpdatedUtc
            }),
            MetadataJson = JsonSerializer.Serialize(new { previousOwnerGroupId, pageUpdatedUtc = page.UpdatedUtc, accessName }),
            OccurredUtc = now
        }, cancellationToken);

        await dbContext.SaveChangesAsync(cancellationToken);
        await pageCacheInvalidationService.RemoveDetailAsync(page.Id, cancellationToken);
        await pageCacheInvalidationService.RemoveGroupPagesAsync(previousOwnerGroupId, cancellationToken);
        await pageCacheInvalidationService.RemoveGlobalAsync(cancellationToken);

        return AppResult<PageGlobalReviewActionDto>.Success(new PageGlobalReviewActionDto(
            true,
            page.Id,
            previousOwnerGroupId,
            ToDto(page, accessName)));
    }

    private static PageDto ToDto(Page page, IReadOnlyDictionary<string, string> accessName)
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
