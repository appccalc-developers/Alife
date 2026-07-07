using System.Text.Json;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Forum.Dtos;
using Alife.Application.Forum.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Forum.Commands.CreateSermonForumComment;

public sealed class CreateSermonForumCommentCommandHandler(
	IAlifeDbContext dbContext,
	IForumAuthorizationService forumAuthorizationService)
	: IRequestHandler<CreateSermonForumCommentCommand, AppResult<ForumPostDetailDto>>
{
	private static readonly Guid ResourcesCategoryId = Guid.Parse("f0f00000-0000-4000-8000-000000000006");

	public async Task<AppResult<ForumPostDetailDto>> Handle(
		CreateSermonForumCommentCommand request,
		CancellationToken cancellationToken)
	{
		var bodyJson = ForumTextPayload.NormalizeOptional(request.Body);

		if (!ForumMediaPayload.TryNormalize(request.Media, 1, allowVideo: true, maxVideos: 1, out var mediaJson, out var mediaError))
		{
			return AppResult<ForumPostDetailDto>.Validation(mediaError!);
		}

		if (bodyJson == "{}" && mediaJson == "[]")
		{
			return AppResult<ForumPostDetailDto>.Validation("Comment must include text, image, or video.");
		}

		if (!await forumAuthorizationService.CanWriteSiteForumAsync(request.CurrentMemberId, cancellationToken))
		{
			return AppResult<ForumPostDetailDto>.Forbidden("You must be a registered member to comment.");
		}

		var sermon = await dbContext.Sermons
			.AsNoTracking()
			.FirstOrDefaultAsync(x => x.Id == request.SermonId, cancellationToken);
		if (sermon is null)
		{
			return AppResult<ForumPostDetailDto>.NotFound("Sermon not found.");
		}

		var now = DateTime.UtcNow;
		var post = await dbContext.ForumPosts
			.Include(x => x.AuthorMember)
			.FirstOrDefaultAsync(x => x.SermonId == request.SermonId, cancellationToken);

		if (post is null)
		{
			post = new ForumPost
			{
				Id = Guid.NewGuid(),
				CategoryId = ResourcesCategoryId,
				SermonId = sermon.Id,
				AuthorMemberId = request.CurrentMemberId,
				TitleJson = SerializeText(sermon.Title, sermon.Title),
				BodyJson = SerializeText($"Discussion for sermon: {sermon.Title}", $"讲道讨论：{sermon.Title}"),
				MediaJson = "[]",
				Visibility = ForumPostVisibility.Public,
				CreatedUtc = now,
				UpdatedUtc = now
			};

			dbContext.ForumPosts.Add(post);
		}

		if (post.IsLocked)
		{
			return AppResult<ForumPostDetailDto>.Forbidden("This sermon discussion is locked.");
		}

		if (!await forumAuthorizationService.CanReadPostAsync(post, request.CurrentMemberId, cancellationToken))
		{
			return AppResult<ForumPostDetailDto>.Forbidden("You do not have permission to comment on this sermon discussion.");
		}

		if (request.ParentCommentId.HasValue)
		{
			var parentExists = await dbContext.ForumComments
				.AsNoTracking()
				.AnyAsync(x => x.Id == request.ParentCommentId.Value && x.PostId == post.Id, cancellationToken);

			if (!parentExists)
			{
				return AppResult<ForumPostDetailDto>.Validation("Parent comment not found.");
			}
		}

		var comment = new ForumComment
		{
			Id = Guid.NewGuid(),
			PostId = post.Id,
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

		var savedPost = await dbContext.ForumPosts
			.AsNoTracking()
			.Include(x => x.AuthorMember)
			.Include(x => x.Sermon)
			.FirstAsync(x => x.Id == post.Id, cancellationToken);

		var comments = await dbContext.ForumComments
			.AsNoTracking()
			.Include(x => x.AuthorMember)
			.Where(x => x.PostId == post.Id && !x.IsHidden)
			.OrderBy(x => x.CreatedUtc)
			.Select(x => new ForumCommentDto(
				x.Id,
				x.PostId,
				x.ParentCommentId,
				x.BodyJson,
				x.MediaJson,
				x.IsHidden,
				x.CreatedUtc,
				x.UpdatedUtc,
				new ForumAuthorDto(x.AuthorMember.Id, x.AuthorMember.DisplayName)))
			.ToListAsync(cancellationToken);

		return AppResult<ForumPostDetailDto>.Success(ForumDtoMapper.ToDetailDto(savedPost, comments));
	}

	private static string SerializeText(string en, string zh)
		=> JsonSerializer.Serialize(new Dictionary<string, string>
		{
			["en"] = en,
			["zh"] = zh
		});
}
