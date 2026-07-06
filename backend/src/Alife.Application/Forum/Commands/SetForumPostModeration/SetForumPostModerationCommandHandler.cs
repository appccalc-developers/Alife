using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Forum.Dtos;
using Alife.Application.Forum.Services;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Forum.Commands.SetForumPostModeration;

public sealed class SetForumPostModerationCommandHandler(
	IAlifeDbContext dbContext,
	IForumAuthorizationService forumAuthorizationService)
	: IRequestHandler<SetForumPostModerationCommand, AppResult<ForumPostDetailDto>>
{
	public async Task<AppResult<ForumPostDetailDto>> Handle(SetForumPostModerationCommand request, CancellationToken cancellationToken)
	{
		var post = await dbContext.ForumPosts
			.IgnoreQueryFilters()
			.Include(x => x.AuthorMember)
			.FirstOrDefaultAsync(x => x.Id == request.PostId && x.DeletedUtc == null, cancellationToken);
		if (post is null)
		{
			return AppResult<ForumPostDetailDto>.NotFound("Forum post not found.");
		}

		var canModerate = post.GroupId.HasValue
			? await forumAuthorizationService.CanModerateGroupForumAsync(post.GroupId.Value, request.CurrentMemberId, cancellationToken)
			: await forumAuthorizationService.CanModerateSiteForumAsync(request.CurrentMemberId, cancellationToken);
		if (!canModerate)
		{
			return AppResult<ForumPostDetailDto>.Forbidden("You do not have permission to moderate this forum post.");
		}

		if (request.IsPinned.HasValue)
		{
			post.IsPinned = request.IsPinned.Value;
		}

		if (request.IsLocked.HasValue)
		{
			post.IsLocked = request.IsLocked.Value;
		}

		if (request.IsHidden.HasValue)
		{
			post.IsHidden = request.IsHidden.Value;
		}

		post.UpdatedUtc = DateTime.UtcNow;
		await dbContext.SaveChangesAsync(cancellationToken);

		return AppResult<ForumPostDetailDto>.Success(ForumDtoMapper.ToDetailDto(post, []));
	}
}
