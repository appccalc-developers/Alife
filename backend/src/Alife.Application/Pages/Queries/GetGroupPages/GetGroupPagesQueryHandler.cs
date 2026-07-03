using Alife.Application.Common.Models;
using Alife.Application.Common.Interfaces;
using Alife.Application.Groups.Services;
using Alife.Application.Pages.Dtos;
using Alife.Application.Pages.Services;
using Alife.Application.Admin;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Alife.Application.Pages.Queries.GetGroupPages;

public sealed class GetGroupPagesQueryHandler(
    IPageReadService pageReadService,
    IGroupReadService groupReadService,
    IGroupAuthorizationService groupAuthorizationService,
    IAlifeDbContext dbContext)
    : IRequestHandler<GetGroupPagesQuery, AppResult<IReadOnlyList<PageDto>>>
{
    public async Task<AppResult<IReadOnlyList<PageDto>>> Handle(GetGroupPagesQuery request, CancellationToken cancellationToken)
    {
        var group = await groupReadService.GetByIdAsync(request.GroupId, cancellationToken);
        if (group is null)
        {
            return AppResult<IReadOnlyList<PageDto>>.NotFound("Group not found.");
        }

        var isLeaderOrCoLeader = request.CurrentMemberId.HasValue &&
            await groupAuthorizationService.IsLeaderOrCoLeaderAsync(
                request.GroupId,
                request.CurrentMemberId.Value,
                cancellationToken);

        var isApproved = request.CurrentMemberId.HasValue &&
            await groupAuthorizationService.IsApprovedMemberAsync(
                request.GroupId,
                request.CurrentMemberId.Value,
                cancellationToken);

        // Subgroup pages are members-only regardless of page visibility.
        if (!group.IsChurch && !isApproved)
        {
            return AppResult<IReadOnlyList<PageDto>>.Forbidden("You do not have access to this group's pages.");
        }

        var pages = await pageReadService.GetGroupPagesAsync(request.GroupId, cancellationToken);

        if (isLeaderOrCoLeader)
        {
            return AppResult<IReadOnlyList<PageDto>>.Success(await AddCurrentRefusalsAsync(pages, cancellationToken));
        }

        if (isApproved)
        {
            return AppResult<IReadOnlyList<PageDto>>.Success(await AddCurrentRefusalsAsync(pages, cancellationToken));
        }

        if (group.IsChurch)
        {
            pages = pages
                .Where(x => x.Visibility == PageVisibility.Public)
                .ToList();

            return AppResult<IReadOnlyList<PageDto>>.Success(pages);
        }

        return AppResult<IReadOnlyList<PageDto>>.Forbidden("You do not have access to this group's pages.");
    }

    private async Task<IReadOnlyList<PageDto>> AddCurrentRefusalsAsync(
        IReadOnlyList<PageDto> pages,
        CancellationToken cancellationToken)
    {
        if (pages.Count == 0)
        {
            return pages;
        }

        var updatedByPageId = pages.ToDictionary(page => page.Id, page => page.UpdatedUtc);
        var pageIds = updatedByPageId.Keys.ToList();

        var refusalRows = await (
            from log in dbContext.AuditLogs.AsNoTracking()
            join actor in dbContext.Members.AsNoTracking()
                on log.ActorMemberId equals actor.Id into actors
            from actor in actors.DefaultIfEmpty()
            where
                log.Action == PageGlobalReviewActions.Refuse &&
                log.EntityType == "page" &&
                log.EntityId.HasValue &&
                pageIds.Contains(log.EntityId.Value)
            orderby log.OccurredUtc descending
            select new
            {
                PageId = log.EntityId!.Value,
                log.ActorMemberId,
                ReviewerDisplayName = actor == null ? null : actor.DisplayName,
                log.OccurredUtc,
                log.MetadataJson
            })
            .ToListAsync(cancellationToken);

        var refusalsByPageId = refusalRows
            .Where(row => row.OccurredUtc >= updatedByPageId[row.PageId])
            .GroupBy(row => row.PageId)
            .ToDictionary(
                group => group.Key,
                group =>
                {
                    var refusal = group.First();
                    return new PageReviewRefusalDto(
                        refusal.ActorMemberId ?? Guid.Empty,
                        refusal.ReviewerDisplayName,
                        refusal.OccurredUtc,
                        ReadRefusalReason(refusal.MetadataJson));
                });

        return pages
            .Select(page => refusalsByPageId.TryGetValue(page.Id, out var refusal)
                ? page with { ReviewRefusal = refusal }
                : page)
            .ToList();
    }

    private static string ReadRefusalReason(string? metadataJson)
    {
        if (string.IsNullOrWhiteSpace(metadataJson))
        {
            return string.Empty;
        }

        try
        {
            using var document = JsonDocument.Parse(metadataJson);
            return document.RootElement.TryGetProperty("reason", out var reasonElement)
                ? reasonElement.GetString() ?? string.Empty
                : string.Empty;
        }
        catch (JsonException)
        {
            return string.Empty;
        }
    }
}
