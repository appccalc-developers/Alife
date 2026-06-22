using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Groups.Services;
using Alife.Application.Pages.Dtos;
using Alife.Application.Pages.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using MediatR;
using System.Text.Json;

namespace Alife.Application.Pages.Commands.CreateGlobalPage;

public sealed class CreateGlobalPageCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IPageCacheInvalidationService pageCacheInvalidationService)
    : IRequestHandler<CreateGlobalPageCommand, AppResult<PageDetailDto>>
{
    public async Task<AppResult<PageDetailDto>> Handle(CreateGlobalPageCommand request, CancellationToken cancellationToken)
    {
        if (!await groupAuthorizationService.IsAdminAsync(request.CurrentMemberId, cancellationToken))
        {
            return AppResult<PageDetailDto>.Forbidden("Only platform admins can create global pages.");
        }

        var pageId = Guid.NewGuid();
        var page = new Page
        {
            Id = pageId,
            Scope = PageScope.Global,
            OwnerGroupId = null,
            CreatedByMemberId = request.CurrentMemberId,
            TitleJson = JsonSerializer.Serialize(request.Title),
            DescriptionJson = request.Description is null ? null : JsonSerializer.Serialize(request.Description),
            TagsJson = request.TagsJson ?? "[]",
            TitleDisplayStyle = request.TitleDisplayStyle ?? "Default",
            Visibility = PageVisibility.Draft,
            UpdatedUtc = DateTime.UtcNow
        };

        dbContext.Pages.Add(page);

        var sections = request.Sections
            .OrderBy(x => x.Order)
            .Select((section, index) => new Section
            {
                Id = Guid.NewGuid(),
                PageId = pageId,
                Order = index + 1,
                Type = section.Type,
                ContentJson = string.IsNullOrWhiteSpace(section.ContentJson) ? "{}" : section.ContentJson,
                StyleJson = string.IsNullOrWhiteSpace(section.StyleJson) ? "{}" : section.StyleJson
            })
            .ToList();

        await dbContext.Sections.AddRangeAsync(sections, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        await pageCacheInvalidationService.RemoveGlobalAsync(cancellationToken);
        await pageCacheInvalidationService.RemoveDetailAsync(page.Id, cancellationToken);

        return AppResult<PageDetailDto>.Success(new PageDetailDto(
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
            sections.Select(x => new PageSectionDto(x.Id, x.Order, x.Type, x.ContentJson, x.StyleJson)).ToList()));
    }

    private static IReadOnlyDictionary<string, string> ReadTextMap(string? value)
        => string.IsNullOrWhiteSpace(value)
            ? new Dictionary<string, string>()
            : JsonSerializer.Deserialize<Dictionary<string, string>>(value) ?? new Dictionary<string, string>();
}
