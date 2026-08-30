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
        var page = await dbContext.Pages
            .Include(x => x.Sections)
            .FirstOrDefaultAsync(x => x.Id == request.PageId, cancellationToken);
        if (page is null)
        {
            return AppResult<PageDto>.NotFound("Page was not found.");
        }

        if (!await groupAuthorizationService.IsLeaderOrCoLeaderAsync(
            page.OwnerGroupId,
            request.CurrentMemberId,
            cancellationToken))
        {
            return AppResult<PageDto>.Forbidden("You do not have permission to publish this page. Only group leaders and co-leaders can publish pages.");
        }

        var now = DateTime.UtcNow;
        page.Visibility = request.Visibility;
        page.UpdatedUtc = now;
        await PagePublicationReviewState.SubmitCopyIfPublicAsync(
            dbContext,
            page,
            request.CurrentMemberId,
            now,
            cancellationToken);

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return AppResult<PageDto>.Conflict(PagePublicationReviewState.ConcurrentChangeMessage);
        }
        await InvalidatePageAsync(page, cancellationToken);

        return AppResult<PageDto>.Success(ToDto(page));
    }

    private async Task InvalidatePageAsync(Domain.Entities.Page page, CancellationToken cancellationToken)
    {
        await pageCacheInvalidationService.RemoveDetailAsync(page.Id, cancellationToken);
        await pageCacheInvalidationService.RemoveGroupPagesAsync(page.OwnerGroupId, cancellationToken);
        await pageCacheInvalidationService.RemovePublishedDetailAsync(page.Id, cancellationToken);
        await pageCacheInvalidationService.RemovePublicAsync(cancellationToken);
    }

    private static PageDto ToDto(Domain.Entities.Page page)
        => new(
            page.Id,
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
