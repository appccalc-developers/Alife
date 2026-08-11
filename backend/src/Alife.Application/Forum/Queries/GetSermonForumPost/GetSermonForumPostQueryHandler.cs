using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Forum.Dtos;
using Alife.Application.Forum.Services;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Forum.Queries.GetSermonForumPost;

public sealed class GetSermonForumPostQueryHandler(
	IAlifeDbContext dbContext,
	IForumAuthorizationService forumAuthorizationService)
	: IRequestHandler<GetSermonForumPostQuery, AppResult<ForumPostDetailDto>>
{
	public async Task<AppResult<ForumPostDetailDto>> Handle(
		GetSermonForumPostQuery request,
		CancellationToken cancellationToken)
	{
		var post = await dbContext.ForumPosts
			.AsNoTracking()
			.IgnoreQueryFilters()
			.Include(x => x.AuthorMember)
			.Include(x => x.Sermon)
			.FirstOrDefaultAsync(x => x.SermonId == request.SermonId && x.DeletedUtc == null, cancellationToken);

		if (post is null)
		{
			return AppResult<ForumPostDetailDto>.NotFound("Sermon forum post not found.");
		}

		if (!await forumAuthorizationService.CanReadPostAsync(post, request.CurrentMemberId, cancellationToken))
		{
			return AppResult<ForumPostDetailDto>.Forbidden("You do not have permission to view this sermon discussion.");
		}

		var canModerate = request.CurrentMemberId.HasValue &&
			await forumAuthorizationService.CanModerateSiteForumAsync(request.CurrentMemberId.Value, cancellationToken);

		var commentsQuery = dbContext.ForumComments
			.AsNoTracking()
			.Include(x => x.AuthorMember)
			.Where(x => x.PostId == post.Id);

		if (!canModerate)
		{
			commentsQuery = commentsQuery.Where(x => !x.IsHidden);
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

		return AppResult<ForumPostDetailDto>.Success(ForumDtoMapper.ToDetailDto(post, comments, useVisibleCommentMetadata: true));
	}
}
