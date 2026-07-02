using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Groups.Services;
using Alife.Application.Pages.Dtos;
using Alife.Application.Pages.Services;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Alife.Application.Pages.Commands.PublishPage;

public sealed class PublishPageCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IPageCacheInvalidationService pageCacheInvalidationService)
    : IRequestHandler<PublishPageCommand, AppResult<PageDto>>
{
    public async Task<AppResult<PageDto>> Handle(PublishPageCommand request, CancellationToken cancellationToken)
    {
        var page = await dbContext.Pages.FirstOrDefaultAsync(x => x.Id == request.PageId, cancellationToken);
        if (page is null)
        {
            return AppResult<PageDto>.NotFound("Page was not found.");
        }

        var canReviewPages = await groupAuthorizationService.CanReviewPagesAsync(request.CurrentMemberId, cancellationToken);

        if (page.Scope == PageScope.Global)
        {
            if (!canReviewPages && !await groupAuthorizationService.IsAdminAsync(request.CurrentMemberId, cancellationToken))
            {
                return AppResult<PageDto>.Forbidden("You do not have permission to publish this page.");
            }
        }
        else if (page.OwnerGroupId is null ||
                 (!canReviewPages &&
                  !await groupAuthorizationService.IsLeaderOrCoLeaderAsync(
                     page.OwnerGroupId.Value,
                     request.CurrentMemberId,
                     cancellationToken)))
        {
            return AppResult<PageDto>.Forbidden("You do not have permission to publish this page.");
        }

        page.Visibility = request.Visibility;
        page.UpdatedUtc = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);
        await InvalidatePageAsync(page, cancellationToken);

        return AppResult<PageDto>.Success(ToDto(page));
    }

    private async Task InvalidatePageAsync(Domain.Entities.Page page, CancellationToken cancellationToken)
    {
        await pageCacheInvalidationService.RemoveDetailAsync(page.Id, cancellationToken);

        if (page.Scope == PageScope.Global)
        {
            await pageCacheInvalidationService.RemoveGlobalAsync(cancellationToken);
            return;
        }

        if (page.OwnerGroupId.HasValue)
        {
            await pageCacheInvalidationService.RemoveGroupPagesAsync(page.OwnerGroupId.Value, cancellationToken);
            await pageCacheInvalidationService.RemoveGlobalAsync(cancellationToken);
        }
    }

    private static PageDto ToDto(Domain.Entities.Page page)
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
