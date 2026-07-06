using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Forum.Services;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Forum.Commands.DeleteForumComment;

public sealed class DeleteForumCommentCommandHandler(
	IAlifeDbContext dbContext,
	IForumAuthorizationService forumAuthorizationService)
	: IRequestHandler<DeleteForumCommentCommand, AppResult<bool>>
{
	public async Task<AppResult<bool>> Handle(DeleteForumCommentCommand request, CancellationToken cancellationToken)
	{
		var comment = await dbContext.ForumComments
			.Include(x => x.Post)
			.FirstOrDefaultAsync(x => x.Id == request.CommentId && x.PostId == request.PostId, cancellationToken);
		if (comment is null)
		{
			return AppResult<bool>.NotFound("Forum comment not found.");
		}

		var canModerate = comment.Post.GroupId.HasValue
			? await forumAuthorizationService.CanModerateGroupForumAsync(comment.Post.GroupId.Value, request.CurrentMemberId, cancellationToken)
			: await forumAuthorizationService.CanModerateSiteForumAsync(request.CurrentMemberId, cancellationToken);
		if (comment.AuthorMemberId != request.CurrentMemberId && !canModerate)
		{
			return AppResult<bool>.Forbidden("You do not have permission to delete this forum comment.");
		}

		var now = DateTime.UtcNow;
		comment.DeletedUtc = now;
		comment.UpdatedUtc = now;
		comment.Post.CommentCount = Math.Max(0, comment.Post.CommentCount - 1);
		comment.Post.UpdatedUtc = now;

		var latestComment = await dbContext.ForumComments
			.AsNoTracking()
			.Where(x => x.PostId == request.PostId && x.Id != request.CommentId)
			.OrderByDescending(x => x.CreatedUtc)
			.Select(x => new { x.CreatedUtc, x.AuthorMemberId })
			.FirstOrDefaultAsync(cancellationToken);

		comment.Post.LastCommentUtc = latestComment?.CreatedUtc;
		comment.Post.LastCommentMemberId = latestComment?.AuthorMemberId;

		await dbContext.SaveChangesAsync(cancellationToken);
		return AppResult<bool>.Success(true);
	}
}
