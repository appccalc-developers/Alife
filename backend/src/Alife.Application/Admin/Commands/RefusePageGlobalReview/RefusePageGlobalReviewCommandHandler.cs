using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Pages.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Alife.Application.Admin.Commands.RefusePageGlobalReview;

public sealed class RefusePageGlobalReviewCommandHandler(
    IAlifeDbContext dbContext,
    IPageCacheInvalidationService pageCacheInvalidationService)
    : IRequestHandler<RefusePageGlobalReviewCommand, AppResult<PageGlobalReviewActionDto>>
{
    private const int MaxReasonLength = 1000;

    public async Task<AppResult<PageGlobalReviewActionDto>> Handle(
        RefusePageGlobalReviewCommand request,
        CancellationToken cancellationToken)
    {
        if (!await AdminPlatformRoleHelpers.CanReviewPagesAsync(dbContext, request.CurrentMemberId, cancellationToken))
        {
            return AppResult<PageGlobalReviewActionDto>.Forbidden("Page reviewer access is required.");
        }

        var reason = NormalizeReason(request.Reason);
        if (string.IsNullOrWhiteSpace(reason))
        {
            return AppResult<PageGlobalReviewActionDto>.Validation("A refusal reason is required.");
        }

        var page = await dbContext.Pages.FirstOrDefaultAsync(x => x.Id == request.PageId, cancellationToken);
        if (page is null)
        {
            return AppResult<PageGlobalReviewActionDto>.NotFound("Page was not found.");
        }

        if (page.Scope != PageScope.Group || page.OwnerGroupId is null || page.Visibility != PageVisibility.Public)
        {
            return AppResult<PageGlobalReviewActionDto>.Conflict("Only public group pages can be refused from global review.");
        }

        var now = DateTime.UtcNow;
        await dbContext.AuditLogs.AddAsync(new AuditLog
        {
            Id = Guid.NewGuid(),
            ActorMemberId = request.CurrentMemberId,
            Action = PageGlobalReviewActions.Refuse,
            EntityType = "page",
            EntityId = page.Id,
            GroupId = page.OwnerGroupId,
            MetadataJson = JsonSerializer.Serialize(new
            {
                pageUpdatedUtc = page.UpdatedUtc,
                reason
            }),
            OccurredUtc = now
        }, cancellationToken);

        await dbContext.SaveChangesAsync(cancellationToken);
        await pageCacheInvalidationService.RemoveDetailAsync(page.Id, cancellationToken);
        await pageCacheInvalidationService.RemoveGroupPagesAsync(page.OwnerGroupId.Value, cancellationToken);
        await pageCacheInvalidationService.RemoveGlobalAsync(cancellationToken);

        return AppResult<PageGlobalReviewActionDto>.Success(new PageGlobalReviewActionDto(
            true,
            page.Id,
            page.OwnerGroupId,
            null));
    }

    private static string NormalizeReason(string value)
    {
        var reason = value.Trim();
        return reason.Length <= MaxReasonLength ? reason : reason[..MaxReasonLength];
    }
}
