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

namespace Alife.Application.Pages.Commands.UpdatePage;

public sealed class UpdatePageCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IPageCacheInvalidationService pageCacheInvalidationService)
    : IRequestHandler<UpdatePageCommand, AppResult<PageDetailDto>>
{
    public async Task<AppResult<PageDetailDto>> Handle(UpdatePageCommand request, CancellationToken cancellationToken)
    {
        var page = await dbContext.Pages
            .Include(x => x.Sections)
            .FirstOrDefaultAsync(x => x.Id == request.PageId, cancellationToken);
        if (page is null)
        {
            return AppResult<PageDetailDto>.NotFound("Page was not found.");
        }

        var canEdit = await CanEditPageAsync(page, request.CurrentMemberId, cancellationToken);
        if (!canEdit)
        {
            return AppResult<PageDetailDto>.Forbidden("You do not have permission to edit this page.");
        }

        page.TitleJson = WriteTextMap(request.Title);
        page.DescriptionJson = request.Description is null ? null : WriteTextMap(request.Description);
        page.TagsJson = request.TagsJson ?? page.TagsJson;
        page.TitleDisplayStyle = request.TitleDisplayStyle ?? page.TitleDisplayStyle;
        page.UpdatedUtc = DateTime.UtcNow;

        var existingById = page.Sections.ToDictionary(x => x.Id);
        var incomingIds = request.Sections.Where(x => x.Id.HasValue).Select(x => x.Id!.Value).ToHashSet();

        foreach (var section in page.Sections.Where(x => !incomingIds.Contains(x.Id)))
        {
            section.IsDeleted = true;
        }

        foreach (var incoming in request.Sections.Select((section, index) => new { Section = section, Order = index + 1 }))
        {
            if (incoming.Section.Id.HasValue && existingById.TryGetValue(incoming.Section.Id.Value, out var existing))
            {
                existing.Order = incoming.Order;
                existing.Type = incoming.Section.Type;
                existing.ContentJson = string.IsNullOrWhiteSpace(incoming.Section.ContentJson) ? "{}" : incoming.Section.ContentJson;
                existing.StyleJson = string.IsNullOrWhiteSpace(incoming.Section.StyleJson) ? "{}" : incoming.Section.StyleJson;
                existing.IsDeleted = false;
                continue;
            }

            dbContext.Sections.Add(new Section
            {
                Id = Guid.NewGuid(),
                PageId = page.Id,
                Order = incoming.Order,
                Type = incoming.Section.Type,
                ContentJson = string.IsNullOrWhiteSpace(incoming.Section.ContentJson) ? "{}" : incoming.Section.ContentJson,
                StyleJson = string.IsNullOrWhiteSpace(incoming.Section.StyleJson) ? "{}" : incoming.Section.StyleJson
            });
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        await InvalidatePageAsync(page, cancellationToken);

        var activeSections = await dbContext.Sections
            .Where(x => x.PageId == page.Id)
            .OrderBy(x => x.Order)
            .ToListAsync(cancellationToken);

        return AppResult<PageDetailDto>.Success(ToDetailDto(page, activeSections));
    }

    private async Task<bool> CanEditPageAsync(Page page, Guid currentMemberId, CancellationToken cancellationToken)
    {
        if (page.Scope == PageScope.Global)
        {
            return await groupAuthorizationService.IsAdminAsync(currentMemberId, cancellationToken);
        }

        if (page.OwnerGroupId is null)
        {
            return false;
        }

        if (page.CreatedByMemberId == currentMemberId && page.Visibility == PageVisibility.InvisibleDraft)
        {
            return true;
        }

        return await groupAuthorizationService.IsLeaderOrCoLeaderAsync(page.OwnerGroupId.Value, currentMemberId, cancellationToken);
    }

    private async Task InvalidatePageAsync(Page page, CancellationToken cancellationToken)
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
        }
    }

    private static PageDetailDto ToDetailDto(Page page, IReadOnlyList<Section> sections)
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
            page.UpdatedUtc,
            sections.Select(x => new PageSectionDto(x.Id, x.Order, x.Type, x.ContentJson, x.StyleJson)).ToList());

    private static string WriteTextMap(IReadOnlyDictionary<string, string> value)
        => JsonSerializer.Serialize(value);

    private static IReadOnlyDictionary<string, string> ReadTextMap(string? value)
        => string.IsNullOrWhiteSpace(value)
            ? new Dictionary<string, string>()
            : JsonSerializer.Deserialize<Dictionary<string, string>>(value) ?? new Dictionary<string, string>();
}
