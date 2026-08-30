using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Pages.Services;
using Alife.Domain.Entities;
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
                page.Visibility == PageVisibility.Public &&
                dbContext.PagePublicationReviews.Any(review => review.PageId == page.Id))
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
        var sectionsByPageId = new Dictionary<Guid, List<Section>>();

        if (pageIds.Count > 0)
        {
            reviewsByPageId = await dbContext.PagePublicationReviews
                .AsNoTracking()
                .Where(review => pageIds.Contains(review.PageId))
                .Select(review => new ReviewRow(
                    review.PageId,
                    review.Status,
                    review.PrimaryMenuId,
                    review.PrimaryMenu != null ? review.PrimaryMenu.NameJson : review.PrimaryMenuNameJson,
                    review.MenuSortOrder,
                    review.AccessNameJson,
                    review.CardImageUrl,
                    review.CardTextJson,
                    review.ReturnReason,
                    review.ReviewedUtc,
                    review.SubmittedSnapshotJson,
                    review.PublishedSnapshotJson))
                .ToDictionaryAsync(
                    review => review.PageId,
                    review => review,
                    cancellationToken);

            sectionsByPageId = (await dbContext.Sections
                    .AsNoTracking()
                    .Include(section => section.Links)
                    .Where(section => pageIds.Contains(section.PageId))
                    .OrderBy(section => section.PageId)
                    .ThenBy(section => section.Order)
                    .ThenBy(section => section.Id)
                    .ToListAsync(cancellationToken))
                .GroupBy(section => section.PageId)
                .ToDictionary(group => group.Key, group => group.ToList());
        }

        var candidates = rows
            .Select(row =>
            {
                reviewsByPageId.TryGetValue(row.Id, out var review);
                sectionsByPageId.TryGetValue(row.Id, out var sections);
                var snapshot = PagePublicationSnapshots.Read(
                    review?.Status == PagePublicationReviewStatus.Approved
                        ? review.PublishedSnapshotJson ?? review.SubmittedSnapshotJson
                        : review?.SubmittedSnapshotJson);
                var snapshotPage = snapshot is null ? null : PagePublicationSnapshots.ToPageDto(snapshot);
                var publishedSnapshot = PagePublicationSnapshots.Read(review?.PublishedSnapshotJson);
                var publishedSnapshotPage = publishedSnapshot is null
                    ? null
                    : PagePublicationSnapshots.ToPageDto(publishedSnapshot);
                var ownerGroupName = ReadTextMap(row.OwnerGroupNameJson);
                var title = snapshotPage?.Title ?? ReadTextMap(row.TitleJson);
                var description = snapshotPage?.Description ?? ReadNullableTextMap(row.DescriptionJson);
                var accessName = ReadNullableTextMap(review?.AccessNameJson) ??
                                 PagePublicationReviewDefaults.CreateAccessName(ownerGroupName, title);
                var extractedCardImageUrl = snapshot is null
                    ? PagePublicationReviewDefaults.ExtractFirstSectionImage(sections ?? [])
                    : PagePublicationReviewDefaults.ExtractFirstSectionImage(snapshot.Sections);
                var cardImageUrl = extractedCardImageUrl ??
                                   (review?.PublishedSnapshotJson is not null || review?.Status == PagePublicationReviewStatus.Approved
                                       ? review.CardImageUrl
                                       : null);
                var isPublished = review?.PublishedSnapshotJson is not null ||
                                  review?.Status == PagePublicationReviewStatus.Approved;
                var publishedTitle = isPublished
                    ? publishedSnapshotPage?.Title ?? ReadTextMap(row.TitleJson)
                    : null;
                var publishedDescription = isPublished
                    ? publishedSnapshotPage?.Description ?? ReadNullableTextMap(row.DescriptionJson)
                    : null;
                var publishedCardImageUrl = isPublished
                    ? review?.CardImageUrl ?? (publishedSnapshot is null
                        ? PagePublicationReviewDefaults.ExtractFirstSectionImage(sections ?? [])
                        : PagePublicationReviewDefaults.ExtractFirstSectionImage(publishedSnapshot.Sections))
                    : null;
                return new AdminPageReviewDto(
                    row.Id,
                    row.OwnerGroupId,
                    ownerGroupName,
                    row.CreatedByMemberId,
                    row.CreatorDisplayName,
                    title,
                    description,
                    snapshotPage?.TagsJson ?? row.TagsJson,
                    snapshotPage?.TitleDisplayStyle ?? row.TitleDisplayStyle,
                    row.Visibility,
                    ToReviewStatus(review?.Status),
                    isPublished,
                    publishedTitle,
                    publishedDescription,
                    publishedCardImageUrl,
                    review?.PrimaryMenuId,
                    ReadNullableTextMap(review?.PrimaryMenuNameJson),
                    review?.MenuSortOrder ?? 0,
                    accessName,
                    cardImageUrl,
                    ReadNullableTextMap(review?.CardTextJson),
                    review?.ReturnReason,
                    review?.ReviewedUtc,
                    snapshotPage?.UpdatedUtc ?? row.UpdatedUtc);
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
        Guid? PrimaryMenuId,
        string? PrimaryMenuNameJson,
        int MenuSortOrder,
        string? AccessNameJson,
        string? CardImageUrl,
        string? CardTextJson,
        string? ReturnReason,
        DateTime? ReviewedUtc,
        string? SubmittedSnapshotJson,
        string? PublishedSnapshotJson);

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
