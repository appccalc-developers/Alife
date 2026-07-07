using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Forum.Dtos;
using Alife.Application.Forum.Services;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Forum.Queries.ListForumPosts;

public sealed class ListForumPostsQueryHandler(
	IAlifeDbContext dbContext,
	IForumAuthorizationService forumAuthorizationService)
	: IRequestHandler<ListForumPostsQuery, AppResult<PagedResult<ForumPostSummaryDto>>>
{
	public async Task<AppResult<PagedResult<ForumPostSummaryDto>>> Handle(
		ListForumPostsQuery request,
		CancellationToken cancellationToken)
	{
		var page = Math.Max(1, request.Page);
		var pageSize = Math.Clamp(request.PageSize, 1, 50);

		if (request.GroupId.HasValue &&
			(request.CurrentMemberId is null ||
			 !await forumAuthorizationService.CanWriteGroupForumAsync(
				 request.GroupId.Value,
				 request.CurrentMemberId.Value,
				 cancellationToken)))
		{
			return AppResult<PagedResult<ForumPostSummaryDto>>.Forbidden("You must be an approved group member to view group forum posts.");
		}

		var query = dbContext.ForumPosts
			.AsNoTracking()
			.Include(x => x.AuthorMember)
			.Include(x => x.Sermon)
			.Where(x => !x.IsHidden);

		if (request.CategoryId.HasValue)
		{
			query = query.Where(x => x.CategoryId == request.CategoryId.Value);
		}

		if (request.GroupId.HasValue)
		{
			query = query.Where(x => x.GroupId == request.GroupId.Value);
		}
		else
		{
			query = query.Where(x => x.GroupId == null);
		}

		if (request.Visibility.HasValue)
		{
			query = query.Where(x => x.Visibility == request.Visibility.Value);
		}

		if (request.CurrentMemberId is null)
		{
			query = query.Where(x => x.Visibility == ForumPostVisibility.Public);
		}
		else if (!await forumAuthorizationService.CanWriteSiteForumAsync(request.CurrentMemberId.Value, cancellationToken))
		{
			query = query.Where(x => x.Visibility == ForumPostVisibility.Public);
		}
		else if (!request.GroupId.HasValue)
		{
			query = query.Where(x => x.Visibility == ForumPostVisibility.Public || x.Visibility == ForumPostVisibility.MembersOnly);
		}

		var totalCount = await query.CountAsync(cancellationToken);
		var posts = await query
			.OrderByDescending(x => x.IsPinned)
			.ThenByDescending(x => x.LastCommentUtc ?? x.UpdatedUtc)
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
				x.CommentCount,
				x.LastCommentUtc,
				x.CreatedUtc,
				x.UpdatedUtc,
				new ForumAuthorDto(x.AuthorMember.Id, x.AuthorMember.DisplayName)))
			.ToListAsync(cancellationToken);

		return AppResult<PagedResult<ForumPostSummaryDto>>.Success(
			new PagedResult<ForumPostSummaryDto>(posts, page, pageSize, totalCount));
	}
}
