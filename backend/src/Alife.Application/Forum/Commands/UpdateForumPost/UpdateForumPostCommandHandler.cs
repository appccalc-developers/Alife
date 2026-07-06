using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Forum.Dtos;
using Alife.Application.Forum.Services;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Forum.Commands.UpdateForumPost;

public sealed class UpdateForumPostCommandHandler(
	IAlifeDbContext dbContext,
	IForumAuthorizationService forumAuthorizationService)
	: IRequestHandler<UpdateForumPostCommand, AppResult<ForumPostDetailDto>>
{
	public async Task<AppResult<ForumPostDetailDto>> Handle(UpdateForumPostCommand request, CancellationToken cancellationToken)
	{
		if (!ForumTextPayload.TryNormalize(request.Title, "Title", out var titleJson, out var titleError))
		{
			return AppResult<ForumPostDetailDto>.Validation(titleError!.Message!);
		}

		if (!ForumTextPayload.TryNormalize(request.Body, "Body", out var bodyJson, out var bodyError))
		{
			return AppResult<ForumPostDetailDto>.Validation(bodyError!.Message!);
		}

		if (!ForumMediaPayload.TryNormalize(request.Media, 9, allowVideo: true, maxVideos: 1, out var mediaJson, out var mediaError))
		{
			return AppResult<ForumPostDetailDto>.Validation(mediaError!);
		}

		var post = await dbContext.ForumPosts
			.Include(x => x.AuthorMember)
			.FirstOrDefaultAsync(x => x.Id == request.PostId, cancellationToken);
		if (post is null)
		{
			return AppResult<ForumPostDetailDto>.NotFound("Forum post not found.");
		}

		var canModerate = post.GroupId.HasValue
			? await forumAuthorizationService.CanModerateGroupForumAsync(post.GroupId.Value, request.CurrentMemberId, cancellationToken)
			: await forumAuthorizationService.CanModerateSiteForumAsync(request.CurrentMemberId, cancellationToken);
		if (post.AuthorMemberId != request.CurrentMemberId && !canModerate)
		{
			return AppResult<ForumPostDetailDto>.Forbidden("You do not have permission to update this forum post.");
		}

		var categoryExists = await dbContext.ForumCategories
			.AsNoTracking()
			.AnyAsync(x => x.Id == request.CategoryId && x.IsEnabled, cancellationToken);
		if (!categoryExists)
		{
			return AppResult<ForumPostDetailDto>.NotFound("Forum category not found.");
		}

		if (post.GroupId.HasValue && request.Visibility != ForumPostVisibility.GroupOnly)
		{
			return AppResult<ForumPostDetailDto>.Validation("Group forum posts must use GroupOnly visibility.");
		}

		if (!post.GroupId.HasValue && request.Visibility == ForumPostVisibility.GroupOnly)
		{
			return AppResult<ForumPostDetailDto>.Validation("GroupOnly visibility requires a group id.");
		}

		post.CategoryId = request.CategoryId;
		post.TitleJson = titleJson;
		post.BodyJson = bodyJson;
		post.MediaJson = mediaJson;
		post.Visibility = request.Visibility;
		post.UpdatedUtc = DateTime.UtcNow;
		await dbContext.SaveChangesAsync(cancellationToken);

		return AppResult<ForumPostDetailDto>.Success(ForumDtoMapper.ToDetailDto(post, []));
	}
}
