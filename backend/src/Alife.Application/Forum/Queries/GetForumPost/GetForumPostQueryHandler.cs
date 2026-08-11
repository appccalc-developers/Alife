using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Forum.Dtos;
using Alife.Application.Forum.Services;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Forum.Queries.GetForumPost;

public sealed class GetForumPostQueryHandler(
	IAlifeDbContext dbContext,
	IForumAuthorizationService forumAuthorizationService)
	: IRequestHandler<GetForumPostQuery, AppResult<ForumPostDetailDto>>
{
	public async Task<AppResult<ForumPostDetailDto>> Handle(
		GetForumPostQuery request,
		CancellationToken cancellationToken)
	{
		var post = await dbContext.ForumPosts
			.AsNoTracking()
			.IgnoreQueryFilters()
			.Include(x => x.AuthorMember)
			.Include(x => x.Sermon)
			.FirstOrDefaultAsync(x => x.Id == request.PostId && x.DeletedUtc == null, cancellationToken);

		if (post is null)
		{
			return AppResult<ForumPostDetailDto>.NotFound("Forum post not found.");
		}

		if (!await forumAuthorizationService.CanReadPostAsync(post, request.CurrentMemberId, cancellationToken))
		{
			return AppResult<ForumPostDetailDto>.Forbidden("You do not have permission to view this forum post.");
		}

		var canModerate = request.CurrentMemberId.HasValue &&
			(post.GroupId.HasValue
				? await forumAuthorizationService.CanModerateGroupForumAsync(post.GroupId.Value, request.CurrentMemberId.Value, cancellationToken)
				: await forumAuthorizationService.CanModerateSiteForumAsync(request.CurrentMemberId.Value, cancellationToken));
		var canReadGroupOnlyComments = post.GroupId.HasValue &&
			request.CurrentMemberId.HasValue &&
			(canModerate || await forumAuthorizationService.CanWriteGroupForumAsync(
				post.GroupId.Value,
				request.CurrentMemberId.Value,
				cancellationToken));

		var commentsQuery = dbContext.ForumComments
			.AsNoTracking()
			.Include(x => x.AuthorMember)
			.Where(x => x.PostId == request.PostId);

		if (!canModerate)
		{
			commentsQuery = commentsQuery.Where(x => !x.IsHidden);
		}

		if (post.GroupId.HasValue && !canReadGroupOnlyComments)
		{
			commentsQuery = commentsQuery.Where(x => x.Visibility == ForumCommentVisibility.Public);
		}

		var comments = await commentsQuery
			.OrderBy(x => x.CreatedUtc)
			.Select(x => new ForumCommentDto(
				x.Id,
				x.PostId,
				x.ParentCommentId,
				x.BodyJson,
				x.MediaJson,
				x.Visibility,
				x.IsHidden,
				x.CreatedUtc,
				x.UpdatedUtc,
				new ForumAuthorDto(x.AuthorMember.Id, x.AuthorMember.DisplayName)))
			.ToListAsync(cancellationToken);

		return AppResult<ForumPostDetailDto>.Success(ForumDtoMapper.ToDetailDto(
			post,
			comments,
			useVisibleCommentMetadata: true,
			restrictUpdatedUtc: post.GroupId.HasValue && !canReadGroupOnlyComments));
	}
}
