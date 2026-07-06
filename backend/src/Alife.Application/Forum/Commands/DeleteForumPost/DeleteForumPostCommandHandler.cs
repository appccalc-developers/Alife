using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Forum.Services;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Forum.Commands.DeleteForumPost;

public sealed class DeleteForumPostCommandHandler(
	IAlifeDbContext dbContext,
	IForumAuthorizationService forumAuthorizationService)
	: IRequestHandler<DeleteForumPostCommand, AppResult<bool>>
{
	public async Task<AppResult<bool>> Handle(DeleteForumPostCommand request, CancellationToken cancellationToken)
	{
		var post = await dbContext.ForumPosts.FirstOrDefaultAsync(x => x.Id == request.PostId, cancellationToken);
		if (post is null)
		{
			return AppResult<bool>.NotFound("Forum post not found.");
		}

		var canModerate = post.GroupId.HasValue
			? await forumAuthorizationService.CanModerateGroupForumAsync(post.GroupId.Value, request.CurrentMemberId, cancellationToken)
			: await forumAuthorizationService.CanModerateSiteForumAsync(request.CurrentMemberId, cancellationToken);
		if (post.AuthorMemberId != request.CurrentMemberId && !canModerate)
		{
			return AppResult<bool>.Forbidden("You do not have permission to delete this forum post.");
		}

		var now = DateTime.UtcNow;
		post.DeletedUtc = now;
		post.UpdatedUtc = now;

		var comments = await dbContext.ForumComments
			.Where(x => x.PostId == post.Id)
			.ToListAsync(cancellationToken);
		foreach (var comment in comments)
		{
			comment.DeletedUtc = now;
			comment.UpdatedUtc = now;
		}

		await dbContext.SaveChangesAsync(cancellationToken);
		return AppResult<bool>.Success(true);
	}
}
