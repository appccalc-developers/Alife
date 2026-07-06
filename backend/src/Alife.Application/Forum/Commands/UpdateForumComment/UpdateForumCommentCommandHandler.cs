using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Forum.Dtos;
using Alife.Application.Forum.Services;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Forum.Commands.UpdateForumComment;

public sealed class UpdateForumCommentCommandHandler(
	IAlifeDbContext dbContext,
	IForumAuthorizationService forumAuthorizationService)
	: IRequestHandler<UpdateForumCommentCommand, AppResult<ForumCommentDto>>
{
	public async Task<AppResult<ForumCommentDto>> Handle(UpdateForumCommentCommand request, CancellationToken cancellationToken)
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

		var comment = await dbContext.ForumComments
			.Include(x => x.Post)
			.Include(x => x.AuthorMember)
			.FirstOrDefaultAsync(x => x.Id == request.CommentId && x.PostId == request.PostId, cancellationToken);
		if (comment is null)
		{
			return AppResult<ForumCommentDto>.NotFound("Forum comment not found.");
		}

		var canModerate = comment.Post.GroupId.HasValue
			? await forumAuthorizationService.CanModerateGroupForumAsync(comment.Post.GroupId.Value, request.CurrentMemberId, cancellationToken)
			: await forumAuthorizationService.CanModerateSiteForumAsync(request.CurrentMemberId, cancellationToken);
		if (comment.AuthorMemberId != request.CurrentMemberId && !canModerate)
		{
			return AppResult<ForumCommentDto>.Forbidden("You do not have permission to update this forum comment.");
		}

		comment.BodyJson = bodyJson;
		comment.MediaJson = mediaJson;
		comment.UpdatedUtc = DateTime.UtcNow;
		await dbContext.SaveChangesAsync(cancellationToken);

		return AppResult<ForumCommentDto>.Success(ForumDtoMapper.ToCommentDto(comment));
	}
}
