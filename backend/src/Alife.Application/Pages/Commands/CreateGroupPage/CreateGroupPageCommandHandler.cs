using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Groups.Services;
using Alife.Application.Pages.Dtos;
using Alife.Application.Pages.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using MediatR;

namespace Alife.Application.Pages.Commands.CreateGroupPage;

public sealed class CreateGroupPageCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IPageCacheInvalidationService pageCacheInvalidationService)
    : IRequestHandler<CreateGroupPageCommand, AppResult<PageDto>>
{
    public async Task<AppResult<PageDto>> Handle(CreateGroupPageCommand request, CancellationToken cancellationToken)
    {
        var isRegistered = await groupAuthorizationService.IsRegisteredMemberAsync(request.CurrentMemberId, cancellationToken);
        if (!isRegistered)
        {
            return AppResult<PageDto>.Validation("Registration required.");
        }

        var canManage = await groupAuthorizationService.IsLeaderOrCoLeaderAsync(
            request.GroupId,
            request.CurrentMemberId,
            cancellationToken);

        if (!canManage)
        {
            return AppResult<PageDto>.Forbidden("You do not have permission to create a page for this group. Only group leaders and co-leaders can create pages.");
        }

        var page = new Page
        {
            Id = Guid.NewGuid(),
            Scope = PageScope.Group,
            OwnerGroupId = request.GroupId,
            CreatedByMemberId = request.CurrentMemberId,
            Title = request.Title,
            Description = request.Description,
            TagsJson = request.TagsJson ?? "[]",
            Slug = request.Slug,
            Language = request.Language,
            TitleDisplayStyle = request.TitleDisplayStyle ?? "Default",
            Visibility = PageVisibility.InvisibleDraft,
            UpdatedUtc = DateTime.UtcNow
        };

        dbContext.Pages.Add(page);
        await dbContext.SaveChangesAsync(cancellationToken);

        await pageCacheInvalidationService.RemoveGroupPagesAsync(request.GroupId, request.Language, cancellationToken);
        await pageCacheInvalidationService.RemoveBySlugAsync(request.Slug, request.Language, cancellationToken);

        return AppResult<PageDto>.Success(ToDto(page));
    }

    private static PageDto ToDto(Page page)
        => new(
            page.Id,
            page.Scope,
            page.OwnerGroupId,
            page.CreatedByMemberId,
            page.Title,
            page.Description,
            page.TagsJson,
            page.TitleDisplayStyle,
            page.Slug,
            page.Language,
            page.Visibility,
            page.UpdatedUtc);
}
