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

        if (page.Scope != PageScope.Group || page.OwnerGroupId is null || page.Visibility != PageVisibility.Public)
        {
            return AppResult<PageGlobalReviewActionDto>.Conflict("Only public group pages can be promoted to global.");
        }

        var now = DateTime.UtcNow;
        var previousOwnerGroupId = page.OwnerGroupId.Value;
        var before = new
        {
            scope = page.Scope.ToString(),
            ownerGroupId = page.OwnerGroupId,
            visibility = page.Visibility.ToString(),
            globalPublicationStatus = "Pending",
            pageUpdatedUtc = page.UpdatedUtc
        };

        await dbContext.AuditLogs.AddAsync(new AuditLog
        {
            Id = Guid.NewGuid(),
            ActorMemberId = request.CurrentMemberId,
            Action = PageGlobalReviewActions.Promote,
            EntityType = "page",
            EntityId = page.Id,
            GroupId = previousOwnerGroupId,
            BeforeJson = JsonSerializer.Serialize(before),
            AfterJson = JsonSerializer.Serialize(new
            {
                scope = page.Scope.ToString(),
                ownerGroupId = page.OwnerGroupId,
                visibility = page.Visibility.ToString(),
                globalPublicationStatus = "Approved",
                pageUpdatedUtc = page.UpdatedUtc
            }),
            MetadataJson = JsonSerializer.Serialize(new { previousOwnerGroupId, pageUpdatedUtc = page.UpdatedUtc }),
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
            ToDto(page)));
    }

    private static PageDto ToDto(Page page)
        => new(
            page.Id,
            page.Scope,
            page.OwnerGroupId,
            page.CreatedByMemberId,
            ReadTextMap(page.TitleJson),
            ReadTextMap(page.DescriptionJson),
            page.TagsJson,
            page.TitleDisplayStyle,
            page.Visibility,
            page.UpdatedUtc);

    private static IReadOnlyDictionary<string, string> ReadTextMap(string? value)
        => string.IsNullOrWhiteSpace(value)
            ? new Dictionary<string, string>()
            : JsonSerializer.Deserialize<Dictionary<string, string>>(value) ?? new Dictionary<string, string>();
}
