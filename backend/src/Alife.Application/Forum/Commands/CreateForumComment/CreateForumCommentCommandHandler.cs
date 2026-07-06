using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Forum.Dtos;
using Alife.Application.Forum.Services;
using Alife.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Forum.Commands.CreateForumComment;

public sealed class CreateForumCommentCommandHandler(
	IAlifeDbContext dbContext,
	IForumAuthorizationService forumAuthorizationService)
	: IRequestHandler<CreateForumCommentCommand, AppResult<ForumCommentDto>>
{
	public async Task<AppResult<ForumCommentDto>> Handle(CreateForumCommentCommand request, CancellationToken cancellationToken)
	{
		var bodyJson = ForumTextPayload.NormalizeOptional(request.Body);

		if (!ForumMediaPayload.TryNormalize(request.Media, 1, allowVideo: true, maxVideos: 1, out var mediaJson, out var mediaError))
		{
			return AppResult<ForumCommentDto>.Validation(mediaError!);
		}

		if (bodyJson == "{}" && mediaJson == "[]")
		{
			return AppResult<ForumCommentDto>.Validation("Comment must include text, image, or video.");
		}

		var post = await dbContext.ForumPosts.FirstOrDefaultAsync(x => x.Id == request.PostId, cancellationToken);
		if (post is null)
		{
			return AppResult<ForumCommentDto>.NotFound("Forum post not found.");
		}

		if (post.IsLocked)
		{
			return AppResult<ForumCommentDto>.Forbidden("This forum post is locked.");
		}

		if (!await forumAuthorizationService.CanReadPostAsync(post, request.CurrentMemberId, cancellationToken))
		{
			return AppResult<ForumCommentDto>.Forbidden("You do not have permission to comment on this forum post.");
		}

		if (!await forumAuthorizationService.CanWriteSiteForumAsync(request.CurrentMemberId, cancellationToken))
		{
			return AppResult<ForumCommentDto>.Forbidden("You must be a registered member to comment.");
		}

		if (request.ParentCommentId.HasValue)
		{
			var parent = await dbContext.ForumComments
				.AsNoTracking()
				.FirstOrDefaultAsync(x => x.Id == request.ParentCommentId.Value && x.PostId == request.PostId, cancellationToken);

			if (parent is null)
			{
				return AppResult<ForumCommentDto>.Validation("Parent comment not found.");
			}
		}

		var now = DateTime.UtcNow;
		var comment = new ForumComment
		{
			Id = Guid.NewGuid(),
			PostId = request.PostId,
			ParentCommentId = request.ParentCommentId,
			AuthorMemberId = request.CurrentMemberId,
			BodyJson = bodyJson,
			MediaJson = mediaJson,
			CreatedUtc = now,
			UpdatedUtc = now
		};

		post.CommentCount += 1;
		post.LastCommentUtc = now;
		post.LastCommentMemberId = request.CurrentMemberId;
		post.UpdatedUtc = now;

		dbContext.ForumComments.Add(comment);
		await dbContext.SaveChangesAsync(cancellationToken);

		comment.AuthorMember = await dbContext.Members
			.AsNoTracking()
			.FirstAsync(x => x.Id == request.CurrentMemberId, cancellationToken);

		return AppResult<ForumCommentDto>.Success(ForumDtoMapper.ToCommentDto(comment));
	}
}
