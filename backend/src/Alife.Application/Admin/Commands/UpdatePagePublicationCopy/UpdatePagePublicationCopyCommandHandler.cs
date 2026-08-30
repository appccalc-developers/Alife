using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Groups.Services;
using Alife.Application.Pages.Dtos;
using Alife.Application.Pages.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Alife.Application.Admin.Commands.UpdatePagePublicationCopy;

public sealed class UpdatePagePublicationCopyCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IPageCacheInvalidationService pageCacheInvalidationService)
    : IRequestHandler<UpdatePagePublicationCopyCommand, AppResult<PageDetailDto>>
{
    public async Task<AppResult<PageDetailDto>> Handle(
        UpdatePagePublicationCopyCommand request,
        CancellationToken cancellationToken)
    {
        if (!await AdminPlatformRoleHelpers.CanReviewPagesAsync(dbContext, request.CurrentMemberId, cancellationToken))
        {
            return AppResult<PageDetailDto>.Forbidden("Page reviewer access is required.");
        }

        var page = await dbContext.Pages.FirstOrDefaultAsync(x => x.Id == request.PageId, cancellationToken);
        if (page is null)
        {
            return AppResult<PageDetailDto>.NotFound("Page was not found.");
        }

        if (!await groupAuthorizationService.IsLeaderOrCoLeaderAsync(
                page.OwnerGroupId,
                request.CurrentMemberId,
                cancellationToken))
        {
            return AppResult<PageDetailDto>.Forbidden("Group leader access is required to modify this publication copy.");
        }

        var review = await dbContext.PagePublicationReviews
            .FirstOrDefaultAsync(x => x.PageId == page.Id, cancellationToken);
        if (review is null)
        {
            return AppResult<PageDetailDto>.NotFound("A publication copy has not been submitted.");
        }

        var now = DateTime.UtcNow;
        var editingPublishedCopy = review.Status == PagePublicationReviewStatus.Approved;
        var existingSnapshot = PagePublicationSnapshots.Read(editingPublishedCopy
            ? review.PublishedSnapshotJson ?? review.SubmittedSnapshotJson
            : review.SubmittedSnapshotJson);
        var snapshotJson = PagePublicationSnapshots.Capture(
            page,
            request.Title,
            request.Description,
            request.TagsJson,
            request.TitleDisplayStyle,
            request.Sections,
            now,
            now,
            existingSnapshot);
        var snapshot = PagePublicationSnapshots.Read(snapshotJson)!;
        if (editingPublishedCopy)
        {
            review.PublishedSnapshotJson = snapshotJson;
            review.PublishedByMemberId = request.CurrentMemberId;
            review.PublishedUtc = now;
            review.CardImageUrl = PagePublicationReviewDefaults.ExtractFirstSectionImage(snapshot.Sections);
        }
        else
        {
            review.SubmittedSnapshotJson = snapshotJson;
        }

        review.UpdatedUtc = now;
        await dbContext.AuditLogs.AddAsync(new AuditLog
        {
            Id = Guid.NewGuid(),
            ActorMemberId = request.CurrentMemberId,
            Action = PagePublicationReviewActions.UpdateCopy,
            EntityType = "page_publication_copy",
            EntityId = page.Id,
            GroupId = page.OwnerGroupId,
            MetadataJson = JsonSerializer.Serialize(new
            {
                review.Status,
                editingPublishedCopy,
                sectionCount = snapshot.Sections.Count,
                snapshot.ContentUpdatedUtc
            }),
            OccurredUtc = now
        }, cancellationToken);

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return AppResult<PageDetailDto>.Conflict(PagePublicationReviewState.ConcurrentChangeMessage);
        }
        if (editingPublishedCopy)
        {
            await pageCacheInvalidationService.RemovePublishedDetailAsync(page.Id, cancellationToken);
            await pageCacheInvalidationService.RemovePublicAsync(cancellationToken);
        }

        return AppResult<PageDetailDto>.Success(PagePublicationSnapshots.ToDetailDto(snapshot));
    }
}
