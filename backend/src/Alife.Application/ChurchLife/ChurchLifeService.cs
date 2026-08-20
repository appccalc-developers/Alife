using Alife.Application.Albums;
using Alife.Application.Announcements;
using Alife.Application.Announcements.Dtos;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Application.Forum.Dtos;
using Alife.Application.Pages.Dtos;
using Alife.Application.Pages.Services;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.ChurchLife;

public sealed class ChurchLifeService(
    IAlifeDbContext db,
    IChurchLifeScopeService scopeService,
    IPageReadService pageReadService,
    IEventReadService eventReadService,
    IAlbumService albumService) : IChurchLifeService
{
    public async Task<AppResult<ChurchLifeListDto<PageDto>>> ListPagesAsync(
        Guid memberId,
        Guid? ownerGroupId,
        CancellationToken cancellationToken)
    {
        var scopeResult = await scopeService.GetScopeAsync(memberId, cancellationToken);
        if (!scopeResult.IsSuccess)
        {
            return CopyFailure<ChurchLifeListDto<PageDto>>(scopeResult);
        }

        var scope = scopeResult.Value!;
        var ownerValidation = ValidateOwnerGroup(scope, ownerGroupId);
        if (ownerValidation is not null)
        {
            return AppResult<ChurchLifeListDto<PageDto>>.Validation(ownerValidation);
        }

        var allPages = new List<PageDto>();
        foreach (var group in scope.Groups)
        {
            allPages.AddRange(await pageReadService.GetGroupPagesAsync(group.Id, cancellationToken));
        }

        var publicPageIds = allPages
            .Where(x => x.Visibility == PageVisibility.Public)
            .Select(x => x.Id)
            .ToList();
        var approvedPublicPageIds = publicPageIds.Count == 0
            ? []
            : await db.PagePublicationReviews
                .AsNoTracking()
                .Where(x =>
                    publicPageIds.Contains(x.PageId) &&
                    x.Status == PagePublicationReviewStatus.Approved)
                .Select(x => x.PageId)
                .Distinct()
                .ToListAsync(cancellationToken);
        var approvedPublicPages = approvedPublicPageIds.ToHashSet();

        var visiblePages = allPages
            .Where(x => x.Visibility != PageVisibility.Draft)
            .Where(x =>
                (x.Visibility == PageVisibility.Group && scope.ApprovedGroupIds.Contains(x.OwnerGroupId)) ||
                (x.Visibility == PageVisibility.Public && approvedPublicPages.Contains(x.Id)))
            .OrderByDescending(x => x.UpdatedUtc)
            .ThenBy(x => x.Id)
            .ToList();
        var groups = BuildGroups(scope, visiblePages.Select(x => x.OwnerGroupId));

        if (ownerGroupId.HasValue)
        {
            visiblePages = visiblePages.Where(x => x.OwnerGroupId == ownerGroupId.Value).ToList();
        }

        return AppResult<ChurchLifeListDto<PageDto>>.Success(new ChurchLifeListDto<PageDto>(visiblePages, groups));
    }

    public async Task<AppResult<ChurchLifeListDto<GroupEventSummaryDto>>> ListEventsAsync(
        Guid memberId,
        Guid? ownerGroupId,
        CancellationToken cancellationToken)
    {
        var scopeResult = await scopeService.GetScopeAsync(memberId, cancellationToken);
        if (!scopeResult.IsSuccess)
        {
            return CopyFailure<ChurchLifeListDto<GroupEventSummaryDto>>(scopeResult);
        }

        var scope = scopeResult.Value!;
        var ownerValidation = ValidateOwnerGroup(scope, ownerGroupId);
        if (ownerValidation is not null)
        {
            return AppResult<ChurchLifeListDto<GroupEventSummaryDto>>.Validation(ownerValidation);
        }

        var allEvents = new List<GroupEventSummaryDto>();
        foreach (var group in scope.Groups)
        {
            allEvents.AddRange(await eventReadService.GetGroupEventsAsync(group.Id, cancellationToken));
        }

        var isChurchMember = scope.ApprovedGroupIds.Contains(scope.ChurchGroupId);
        var visibleEvents = allEvents
            .Where(EventVisibilityPolicy.IsPublished)
            .Where(groupEvent => CanViewEvent(
                groupEvent,
                scope.ApprovedGroupIds.Contains(groupEvent.GroupId),
                isChurchMember))
            .Select(groupEvent => scope.ApprovedGroupIds.Contains(groupEvent.GroupId)
                ? groupEvent
                : EventVisibilityPolicy.SanitizeForExpandedAudience(groupEvent))
            .OrderBy(x => x.StartDate)
            .ThenBy(x => x.EndDate)
            .ThenBy(x => x.Id)
            .ToList();
        var groups = BuildGroups(scope, visibleEvents.Select(x => x.GroupId));

        if (ownerGroupId.HasValue)
        {
            visibleEvents = visibleEvents.Where(x => x.GroupId == ownerGroupId.Value).ToList();
        }

        return AppResult<ChurchLifeListDto<GroupEventSummaryDto>>.Success(
            new ChurchLifeListDto<GroupEventSummaryDto>(visibleEvents, groups));
    }

    public async Task<AppResult<ChurchLifeListDto<AnnouncementDto>>> ListAnnouncementsAsync(
        Guid memberId,
        Guid? ownerGroupId,
        CancellationToken cancellationToken)
    {
        var scopeResult = await scopeService.GetScopeAsync(memberId, cancellationToken);
        if (!scopeResult.IsSuccess)
        {
            return CopyFailure<ChurchLifeListDto<AnnouncementDto>>(scopeResult);
        }

        var scope = scopeResult.Value!;
        var ownerValidation = ValidateOwnerGroup(scope, ownerGroupId);
        if (ownerValidation is not null)
        {
            return AppResult<ChurchLifeListDto<AnnouncementDto>>.Validation(ownerValidation);
        }

        var scopeIds = scope.Groups.Select(x => x.Id).ToList();
        var memberGroupIds = scope.ApprovedGroupIds.ToList();
        var isChurchMember = scope.ApprovedGroupIds.Contains(scope.ChurchGroupId);
        var now = DateTime.UtcNow;
        var announcements = await db.Announcements
            .AsNoTracking()
            .Where(x =>
                scopeIds.Contains(x.GroupId) &&
                x.Status == AnnouncementStatus.Published &&
                x.PublishUtc <= now &&
                (!x.ExpireUtc.HasValue || x.ExpireUtc > now) &&
                (x.Audience == AnnouncementAudience.Public ||
                 (x.Audience == AnnouncementAudience.SpecificGroup && memberGroupIds.Contains(x.GroupId)) ||
                 (x.Audience == AnnouncementAudience.ChurchMembers && isChurchMember)))
            .OrderByDescending(x => x.IsPinned)
            .ThenByDescending(x => x.Priority)
            .ThenByDescending(x => x.PublishUtc)
            .ThenBy(x => x.Id)
            .ToListAsync(cancellationToken);
        var visibleAnnouncements = announcements.Select(AnnouncementMapper.ToDto).ToList();
        var groups = BuildGroups(scope, visibleAnnouncements.Select(x => x.GroupId));

        if (ownerGroupId.HasValue)
        {
            visibleAnnouncements = visibleAnnouncements.Where(x => x.GroupId == ownerGroupId.Value).ToList();
        }

        return AppResult<ChurchLifeListDto<AnnouncementDto>>.Success(
            new ChurchLifeListDto<AnnouncementDto>(visibleAnnouncements, groups));
    }

    public async Task<AppResult<ChurchLifeListDto<AlbumSummaryDto>>> ListAlbumsAsync(
        Guid memberId,
        Guid? ownerGroupId,
        CancellationToken cancellationToken)
    {
        var scopeResult = await scopeService.GetScopeAsync(memberId, cancellationToken);
        if (!scopeResult.IsSuccess)
        {
            return CopyFailure<ChurchLifeListDto<AlbumSummaryDto>>(scopeResult);
        }

        var scope = scopeResult.Value!;
        var ownerValidation = ValidateOwnerGroup(scope, ownerGroupId);
        if (ownerValidation is not null)
        {
            return AppResult<ChurchLifeListDto<AlbumSummaryDto>>.Validation(ownerValidation);
        }

        var albums = await albumService.ListChurchLifeAsync(
            scope.Groups.Select(x => x.Id).ToList(),
            scope.ApprovedGroupIds.ToList(),
            cancellationToken);
        var groupOrder = scope.Groups.Select((group, index) => new { group.Id, Index = index })
            .ToDictionary(x => x.Id, x => x.Index);
        var visibleAlbums = albums
            .OrderBy(x => groupOrder.GetValueOrDefault(x.GroupId, int.MaxValue))
            .ThenBy(x => x.SortOrder)
            .ThenBy(x => x.Id)
            .ToList();
        var groups = BuildGroups(scope, visibleAlbums.Select(x => x.GroupId));

        if (ownerGroupId.HasValue)
        {
            visibleAlbums = visibleAlbums.Where(x => x.GroupId == ownerGroupId.Value).ToList();
        }

        return AppResult<ChurchLifeListDto<AlbumSummaryDto>>.Success(
            new ChurchLifeListDto<AlbumSummaryDto>(visibleAlbums, groups));
    }

    public async Task<AppResult<ChurchLifePagedDto<ForumPostSummaryDto>>> ListForumPostsAsync(
        Guid memberId,
        Guid? ownerGroupId,
        Guid? categoryId,
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        var scopeResult = await scopeService.GetScopeAsync(memberId, cancellationToken);
        if (!scopeResult.IsSuccess)
        {
            return CopyFailure<ChurchLifePagedDto<ForumPostSummaryDto>>(scopeResult);
        }

        var scope = scopeResult.Value!;
        var ownerValidation = ValidateOwnerGroup(scope, ownerGroupId);
        if (ownerValidation is not null)
        {
            return AppResult<ChurchLifePagedDto<ForumPostSummaryDto>>.Validation(ownerValidation);
        }

        if (categoryId.HasValue && !await db.ForumCategories
                .AsNoTracking()
                .AnyAsync(x => x.Id == categoryId.Value && x.IsEnabled, cancellationToken))
        {
            return AppResult<ChurchLifePagedDto<ForumPostSummaryDto>>.Validation(
                "The forum category must be enabled and available.");
        }

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 50);
        var scopeIds = scope.Groups.Select(x => x.Id).ToList();
        var memberGroupIds = scope.ApprovedGroupIds.ToList();
        var query = db.ForumPosts
            .AsNoTracking()
            .Where(x =>
                !x.IsHidden &&
                x.GroupId.HasValue &&
                scopeIds.Contains(x.GroupId.Value) &&
                (x.Visibility == ForumPostVisibility.Public ||
                 (x.Visibility == ForumPostVisibility.GroupOnly && memberGroupIds.Contains(x.GroupId.Value))));

        if (ownerGroupId.HasValue)
        {
            query = query.Where(x => x.GroupId == ownerGroupId.Value);
        }

        if (categoryId.HasValue)
        {
            query = query.Where(x => x.CategoryId == categoryId.Value);
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var posts = await query
            .OrderByDescending(x => x.IsPinned)
            .ThenByDescending(x =>
                x.Comments
                    .Where(comment =>
                        !comment.IsHidden &&
                        (comment.Visibility == ForumCommentVisibility.Public || memberGroupIds.Contains(x.GroupId!.Value)))
                    .Max(comment => (DateTime?)comment.CreatedUtc) ??
                (memberGroupIds.Contains(x.GroupId!.Value) ? x.UpdatedUtc : x.CreatedUtc))
            .ThenByDescending(x => x.CreatedUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new ForumPostSummaryDto(
                x.Id,
                x.CategoryId,
                x.GroupId,
                x.SermonId,
                x.Sermon == null
                    ? null
                    : new ForumSermonDto(
                        x.Sermon.Id,
                        x.Sermon.Title,
                        x.Sermon.SpeakerName,
                        x.Sermon.ThumbnailUrl,
                        !string.IsNullOrWhiteSpace(x.Sermon.VideoUrl)
                            ? x.Sermon.VideoUrl
                            : !string.IsNullOrWhiteSpace(x.Sermon.YoutubeVideoId)
                                ? "https://www.youtube.com/watch?v=" + x.Sermon.YoutubeVideoId
                                : null,
                        x.Sermon.PreachedAtUtc),
                x.TitleJson,
                x.BodyJson,
                x.MediaJson,
                x.Visibility,
                x.IsPinned,
                x.IsLocked,
                x.IsHidden,
                x.Comments.Count(comment =>
                    !comment.IsHidden &&
                    (comment.Visibility == ForumCommentVisibility.Public || memberGroupIds.Contains(x.GroupId!.Value))),
                x.Comments
                    .Where(comment =>
                        !comment.IsHidden &&
                        (comment.Visibility == ForumCommentVisibility.Public || memberGroupIds.Contains(x.GroupId!.Value)))
                    .Max(comment => (DateTime?)comment.CreatedUtc),
                x.CreatedUtc,
                memberGroupIds.Contains(x.GroupId!.Value)
                    ? x.UpdatedUtc
                    : x.Comments
                        .Where(comment => !comment.IsHidden && comment.Visibility == ForumCommentVisibility.Public)
                        .Max(comment => (DateTime?)comment.CreatedUtc) ?? x.CreatedUtc,
                new ForumAuthorDto(x.AuthorMember.Id, x.AuthorMember.DisplayName)))
            .ToListAsync(cancellationToken);

        var visibleOwnerIds = await db.ForumPosts
            .AsNoTracking()
            .Where(x =>
                !x.IsHidden &&
                x.GroupId.HasValue &&
                scopeIds.Contains(x.GroupId.Value) &&
                (x.Visibility == ForumPostVisibility.Public ||
                 (x.Visibility == ForumPostVisibility.GroupOnly && memberGroupIds.Contains(x.GroupId.Value))))
            .Select(x => x.GroupId!.Value)
            .Distinct()
            .ToListAsync(cancellationToken);
        var groups = BuildGroups(scope, visibleOwnerIds);

        return AppResult<ChurchLifePagedDto<ForumPostSummaryDto>>.Success(
            new ChurchLifePagedDto<ForumPostSummaryDto>(posts, groups, page, pageSize, totalCount));
    }

    private static bool CanViewEvent(GroupEventSummaryDto groupEvent, bool isOwnerGroupMember, bool isChurchMember)
        => groupEvent.Visibility switch
        {
            EventVisibilityPolicy.Public => true,
            EventVisibilityPolicy.ChurchVisible => isChurchMember,
            _ => isOwnerGroupMember
        };

    private static string? ValidateOwnerGroup(ChurchLifeScope scope, Guid? ownerGroupId)
        => ownerGroupId.HasValue && scope.Groups.All(x => x.Id != ownerGroupId.Value)
            ? "The owning group must belong to the open church hierarchy."
            : null;

    private static IReadOnlyList<ChurchLifeGroupDto> BuildGroups(
        ChurchLifeScope scope,
        IEnumerable<Guid> visibleOwnerIds)
    {
        var visibleOwners = visibleOwnerIds.ToHashSet();
        var selectableIds = scope.Groups
            .Where(group =>
                group.Id == scope.ChurchGroupId ||
                group.AccessType != AccessType.Private ||
                scope.ApprovedGroupIds.Contains(group.Id) ||
                visibleOwners.Contains(group.Id))
            .Select(group => group.Id)
            .ToHashSet();
        var includedIds = scope.Groups
            .Where(group => selectableIds.Contains(group.Id))
            .SelectMany(group => group.PathIds)
            .ToHashSet();

        return scope.Groups
            .Where(group => includedIds.Contains(group.Id))
            .Select(group => new ChurchLifeGroupDto(
                group.Id,
                group.ParentGroupId,
                group.Name,
                group.PathIds,
                group.CanManage,
                selectableIds.Contains(group.Id)))
            .ToList();
    }

    private static AppResult<T> CopyFailure<T>(AppResult<ChurchLifeScope> source)
        => source.Status switch
        {
            AppResultStatus.NotFound => AppResult<T>.NotFound(source.Message ?? "Church group was not found."),
            AppResultStatus.Forbidden => AppResult<T>.Forbidden(source.Message ?? "Church Life is not available."),
            AppResultStatus.ValidationError => AppResult<T>.Validation(source.Message ?? "The request is invalid."),
            AppResultStatus.Conflict => AppResult<T>.Conflict(source.Message ?? "The request conflicts with the current state."),
            _ => throw new InvalidOperationException("A successful Church Life scope cannot be copied as a failure.")
        };
}
