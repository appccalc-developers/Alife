using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Forum.Dtos;
using Alife.Application.Forum.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Forum.Commands.CreateForumPost;

public sealed class CreateForumPostCommandHandler(
	IAlifeDbContext dbContext,
	IForumAuthorizationService forumAuthorizationService)
	: IRequestHandler<CreateForumPostCommand, AppResult<ForumPostDetailDto>>
{
	public async Task<AppResult<ForumPostDetailDto>> Handle(
		CreateForumPostCommand request,
		CancellationToken cancellationToken)
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

		if (!await forumAuthorizationService.CanWriteSiteForumAsync(request.CurrentMemberId, cancellationToken))
		{
			return AppResult<ForumPostDetailDto>.Forbidden("You must be a registered member to create forum posts.");
		}

		var categoryExists = await dbContext.ForumCategories
			.AsNoTracking()
			.AnyAsync(x => x.Id == request.CategoryId && x.IsEnabled, cancellationToken);
		if (!categoryExists)
		{
			return AppResult<ForumPostDetailDto>.NotFound("Forum category not found.");
		}

		if (request.GroupId.HasValue)
		{
			if (request.Visibility is not (ForumPostVisibility.Public or ForumPostVisibility.GroupOnly))
			{
				return AppResult<ForumPostDetailDto>.Validation("Group forum posts must use Public or GroupOnly visibility.");
			}

			if (!await forumAuthorizationService.CanWriteGroupForumAsync(request.GroupId.Value, request.CurrentMemberId, cancellationToken))
			{
				return AppResult<ForumPostDetailDto>.Forbidden("You must be an approved group member to create group forum posts.");
			}
		}
		else if (request.Visibility == ForumPostVisibility.GroupOnly)
		{
			return AppResult<ForumPostDetailDto>.Validation("GroupOnly visibility requires a group id.");
		}

		var now = DateTime.UtcNow;
		var post = new ForumPost
		{
			Id = Guid.NewGuid(),
			CategoryId = request.CategoryId,
			GroupId = request.GroupId,
			AuthorMemberId = request.CurrentMemberId,
			TitleJson = titleJson,
			BodyJson = bodyJson,
			MediaJson = mediaJson,
			Visibility = request.Visibility,
			CreatedUtc = now,
			UpdatedUtc = now
		};

		dbContext.ForumPosts.Add(post);
		await dbContext.SaveChangesAsync(cancellationToken);

		post.AuthorMember = await dbContext.Members
			.AsNoTracking()
			.FirstAsync(x => x.Id == request.CurrentMemberId, cancellationToken);

		return AppResult<ForumPostDetailDto>.Success(ForumDtoMapper.ToDetailDto(post, []));
	}
}
