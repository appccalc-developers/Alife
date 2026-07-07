using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Groups.Services;
using Alife.Application.Pages.Dtos;
using Alife.Application.Pages.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using MediatR;
using System.Text.Json;

namespace Alife.Application.Pages.Commands.CreateGroupPage;

public sealed class CreateGroupPageCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IPageCacheInvalidationService pageCacheInvalidationService)
    : IRequestHandler<CreateGroupPageCommand, AppResult<PageDetailDto>>
{
    public async Task<AppResult<PageDetailDto>> Handle(CreateGroupPageCommand request, CancellationToken cancellationToken)
    {
        var isRegistered = await groupAuthorizationService.IsRegisteredMemberAsync(request.CurrentMemberId, cancellationToken);
        if (!isRegistered)
        {
            return AppResult<PageDetailDto>.Validation("Registration required.");
        }

        var canManage = await groupAuthorizationService.IsLeaderOrCoLeaderAsync(
            request.GroupId,
            request.CurrentMemberId,
            cancellationToken);

        if (!canManage)
        {
            return AppResult<PageDetailDto>.Forbidden("You do not have permission to create a page for this group. Only group leaders and co-leaders can create pages.");
        }

        var pageId = Guid.NewGuid();
        var page = new Page
        {
            Id = pageId,
            OwnerGroupId = request.GroupId,
            CreatedByMemberId = request.CurrentMemberId,
            TitleJson = WriteTextMap(request.Title),
            DescriptionJson = request.Description is null ? null : WriteTextMap(request.Description),
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

        await pageCacheInvalidationService.RemoveGroupPagesAsync(request.GroupId, cancellationToken);
        await pageCacheInvalidationService.RemoveDetailAsync(page.Id, cancellationToken);

        return AppResult<PageDetailDto>.Success(ToDetailDto(page, sections));
    }

    private static PageDetailDto ToDetailDto(Page page, IReadOnlyList<Section> sections)
        => new(
            page.Id,
            page.OwnerGroupId,
            page.CreatedByMemberId,
            ReadTextMap(page.TitleJson),
            ReadTextMap(page.DescriptionJson),
            page.TagsJson,
            page.TitleDisplayStyle,
            page.Visibility,
            page.UpdatedUtc,
            sections
                .OrderBy(x => x.Order)
                .Select(x => new PageSectionDto(x.Id, x.Order, x.Type, x.ContentJson, x.StyleJson))
                .ToList());

    private static string WriteTextMap(IReadOnlyDictionary<string, string> value)
        => JsonSerializer.Serialize(value);

    private static IReadOnlyDictionary<string, string> ReadTextMap(string? value)
        => string.IsNullOrWhiteSpace(value)
            ? new Dictionary<string, string>()
            : JsonSerializer.Deserialize<Dictionary<string, string>>(value) ?? new Dictionary<string, string>();
}
