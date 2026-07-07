using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Alife.Application.Admin.Queries.ListPageReviewCandidates;

public sealed class ListPageReviewCandidatesQueryHandler(IAlifeDbContext dbContext)
    : IRequestHandler<ListPageReviewCandidatesQuery, AppResult<IReadOnlyList<AdminPageReviewDto>>>
{
    public async Task<AppResult<IReadOnlyList<AdminPageReviewDto>>> Handle(
        ListPageReviewCandidatesQuery request,
        CancellationToken cancellationToken)
    {
        if (!await AdminPlatformRoleHelpers.CanReviewPagesAsync(dbContext, request.CurrentMemberId, cancellationToken))
        {
            return AppResult<IReadOnlyList<AdminPageReviewDto>>.Forbidden("Page reviewer access is required.");
        }

        var rows = await dbContext.Pages
            .AsNoTracking()
            .Where(page =>
                page.Visibility == PageVisibility.Public)
            .OrderByDescending(page => page.UpdatedUtc)
            .Select(page => new
            {
                page.Id,
                page.OwnerGroupId,
                OwnerGroupNameJson = page.OwnerGroup == null ? null : page.OwnerGroup.NameJson,
                page.CreatedByMemberId,
                CreatorDisplayName = page.CreatedByMember.DisplayName,
                page.TitleJson,
                page.DescriptionJson,
                page.TagsJson,
                page.TitleDisplayStyle,
                page.Visibility,
                page.UpdatedUtc
            })
            .ToListAsync(cancellationToken);

        var pageIds = rows.Select(row => row.Id).ToList();
        var reviewsByPageId = new Dictionary<Guid, ReviewRow>();

        if (pageIds.Count > 0)
        {
            reviewsByPageId = await dbContext.PagePublicationReviews
                .AsNoTracking()
                .Where(review => pageIds.Contains(review.PageId))
                .Select(review => new ReviewRow(
                    review.PageId,
                    review.Status,
                    review.AccessNameJson,
                    review.CardImageUrl,
                    review.CardTextJson,
                    review.ReturnReason,
                    review.ReviewedUtc))
                .ToDictionaryAsync(
                    review => review.PageId,
                    review => review,
                    cancellationToken);
        }

        var candidates = rows
            .Select(row =>
            {
                reviewsByPageId.TryGetValue(row.Id, out var review);
                return new AdminPageReviewDto(
                    row.Id,
                    row.OwnerGroupId,
                    ReadTextMap(row.OwnerGroupNameJson),
                    row.CreatedByMemberId,
                    row.CreatorDisplayName,
                    ReadTextMap(row.TitleJson),
                    ReadNullableTextMap(row.DescriptionJson),
                    row.TagsJson,
                    row.TitleDisplayStyle,
                    row.Visibility,
                    ToReviewStatus(review?.Status),
                    ReadNullableTextMap(review?.AccessNameJson),
                    review?.CardImageUrl,
                    ReadNullableTextMap(review?.CardTextJson),
                    review?.ReturnReason,
                    review?.ReviewedUtc,
                    row.UpdatedUtc);
            })
            .ToList();

        return AppResult<IReadOnlyList<AdminPageReviewDto>>.Success(candidates);
    }

    private static AdminPageReviewStatus ToReviewStatus(PagePublicationReviewStatus? status)
        => status switch
        {
            PagePublicationReviewStatus.Approved => AdminPageReviewStatus.Approved,
            PagePublicationReviewStatus.Returned => AdminPageReviewStatus.Returned,
            _ => AdminPageReviewStatus.Pending
        };

    private sealed record ReviewRow(
        Guid PageId,
        PagePublicationReviewStatus Status,
        string? AccessNameJson,
        string? CardImageUrl,
        string? CardTextJson,
        string? ReturnReason,
        DateTime? ReviewedUtc);

    private static IReadOnlyDictionary<string, string> ReadTextMap(string? value)
        => ReadNullableTextMap(value) ?? new Dictionary<string, string>();

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
}
