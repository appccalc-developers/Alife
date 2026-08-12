using Alife.Api.Http;
using Alife.Api.Results;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Forum.Commands.CreateForumComment;
using Alife.Application.Forum.Commands.CreateForumPost;
using Alife.Application.Forum.Commands.DeleteForumComment;
using Alife.Application.Forum.Commands.DeleteForumPost;
using Alife.Application.Forum.Commands.SetForumPostModeration;
using Alife.Application.Forum.Commands.UpdateForumComment;
using Alife.Application.Forum.Commands.UpdateForumPost;
using Alife.Application.Forum.Services;
using Alife.Application.Forum.Queries.GetForumPost;
using Alife.Application.Forum.Queries.ListForumCategories;
using Alife.Application.Forum.Queries.ListForumPosts;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Controllers;

[ApiController]
[Route("api/forum")]
public class ForumController(
	IMediator mediator,
	ICurrentMemberAccessor currentMemberAccessor) : ControllerBase
{
	[HttpGet("categories")]
	[AllowAnonymous]
	public async Task<IActionResult> ListCategories(CancellationToken cancellationToken)
	{
		var result = await mediator.Send(new ListForumCategoriesQuery(), cancellationToken);
		this.ApplyPrivateNoCacheHeaders();
		return this.ToActionResult(result);
	}

	[HttpGet("posts")]
	[AllowAnonymous]
	public async Task<IActionResult> ListPosts(
		[FromQuery] Guid? categoryId,
		[FromQuery] Guid? groupId,
		[FromQuery] ForumPostVisibility? visibility,
		[FromQuery] int page,
		[FromQuery] int pageSize,
		CancellationToken cancellationToken)
	{
		var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
		var result = await mediator.Send(
			new ListForumPostsQuery(currentMemberId, categoryId, groupId, visibility, page <= 0 ? 1 : page, pageSize <= 0 ? 20 : pageSize),
			cancellationToken);

		this.ApplyPrivateNoCacheHeaders();
		return this.ToActionResult(result);
	}

	[HttpGet("posts/{postId:guid}")]
	[AllowAnonymous]
	public async Task<IActionResult> GetPost(Guid postId, CancellationToken cancellationToken)
	{
		var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
		var result = await mediator.Send(new GetForumPostQuery(postId, currentMemberId), cancellationToken);
		this.ApplyPrivateNoCacheHeaders();
		return this.ToActionResult(result);
	}

	[HttpPost("posts")]
	[Authorize]
	public async Task<IActionResult> CreatePost([FromBody] ForumPostRequest request, CancellationToken cancellationToken)
	{
		var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
		if (currentMemberId is null)
		{
			return Unauthorized();
		}

		var result = await mediator.Send(
			new CreateForumPostCommand(
				currentMemberId.Value,
				request.CategoryId,
				request.GroupId,
				request.Title,
				request.Body,
				request.Media,
				request.Visibility),
			cancellationToken);

		if (!result.IsSuccess)
		{
			return this.ToActionResult(result);
		}

		this.ApplyPrivateNoCacheHeaders();
		return CreatedAtAction(nameof(GetPost), new { postId = result.Value!.Id }, result.Value);
	}

	[HttpPut("posts/{postId:guid}")]
	[Authorize]
	public async Task<IActionResult> UpdatePost(Guid postId, [FromBody] ForumPostRequest request, CancellationToken cancellationToken)
	{
		var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
		if (currentMemberId is null)
		{
			return Unauthorized();
		}

		var result = await mediator.Send(
			new UpdateForumPostCommand(
				postId,
				currentMemberId.Value,
				request.CategoryId,
				request.Title,
				request.Body,
				request.Media,
				request.Visibility),
			cancellationToken);

		this.ApplyPrivateNoCacheHeaders();
		return this.ToActionResult(result);
	}

	[HttpDelete("posts/{postId:guid}")]
	[Authorize]
	public async Task<IActionResult> DeletePost(Guid postId, CancellationToken cancellationToken)
	{
		var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
		if (currentMemberId is null)
		{
			return Unauthorized();
		}

		var result = await mediator.Send(new DeleteForumPostCommand(postId, currentMemberId.Value), cancellationToken);
		if (!result.IsSuccess)
		{
			return this.ToActionResult(result);
		}

		this.ApplyPrivateNoCacheHeaders();
		return NoContent();
	}

	[HttpPost("posts/{postId:guid}/comments")]
	[Authorize]
	public async Task<IActionResult> CreateComment(Guid postId, [FromBody] ForumCommentRequest request, CancellationToken cancellationToken)
	{
		var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
		if (currentMemberId is null)
		{
			return Unauthorized();
		}

		var result = await mediator.Send(
			new CreateForumCommentCommand(postId, currentMemberId.Value, request.ParentCommentId, request.Body, request.Media, request.Visibility),
			cancellationToken);

		if (!result.IsSuccess)
		{
			return this.ToActionResult(result);
		}

		this.ApplyPrivateNoCacheHeaders();
		return CreatedAtAction(nameof(GetPost), new { postId }, result.Value);
	}

	[HttpPut("posts/{postId:guid}/comments/{commentId:guid}")]
	[Authorize]
	public async Task<IActionResult> UpdateComment(
		Guid postId,
		Guid commentId,
		[FromBody] ForumCommentRequest request,
		CancellationToken cancellationToken)
	{
		var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
		if (currentMemberId is null)
		{
			return Unauthorized();
		}

		var result = await mediator.Send(
			new UpdateForumCommentCommand(postId, commentId, currentMemberId.Value, request.Body, request.Media, request.Visibility),
			cancellationToken);

		this.ApplyPrivateNoCacheHeaders();
		return this.ToActionResult(result);
	}

	[HttpDelete("posts/{postId:guid}/comments/{commentId:guid}")]
	[Authorize]
	public async Task<IActionResult> DeleteComment(Guid postId, Guid commentId, CancellationToken cancellationToken)
	{
		var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
		if (currentMemberId is null)
		{
			return Unauthorized();
		}

		var result = await mediator.Send(
			new DeleteForumCommentCommand(postId, commentId, currentMemberId.Value),
			cancellationToken);
		if (!result.IsSuccess)
		{
			return this.ToActionResult(result);
		}

		this.ApplyPrivateNoCacheHeaders();
		return NoContent();
	}

	[HttpPost("posts/{postId:guid}/pin")]
	[Authorize]
	public Task<IActionResult> Pin(Guid postId, CancellationToken cancellationToken)
		=> Moderate(postId, isPinned: true, isLocked: null, isHidden: null, cancellationToken);

	[HttpPost("posts/{postId:guid}/unpin")]
	[Authorize]
	public Task<IActionResult> Unpin(Guid postId, CancellationToken cancellationToken)
		=> Moderate(postId, isPinned: false, isLocked: null, isHidden: null, cancellationToken);

	[HttpPost("posts/{postId:guid}/lock")]
	[Authorize]
	public Task<IActionResult> Lock(Guid postId, CancellationToken cancellationToken)
		=> Moderate(postId, isPinned: null, isLocked: true, isHidden: null, cancellationToken);

	[HttpPost("posts/{postId:guid}/unlock")]
	[Authorize]
	public Task<IActionResult> Unlock(Guid postId, CancellationToken cancellationToken)
		=> Moderate(postId, isPinned: null, isLocked: false, isHidden: null, cancellationToken);

	[HttpPost("posts/{postId:guid}/hide")]
	[Authorize]
	public Task<IActionResult> Hide(Guid postId, CancellationToken cancellationToken)
		=> Moderate(postId, isPinned: null, isLocked: null, isHidden: true, cancellationToken);

	[HttpPost("posts/{postId:guid}/restore")]
	[Authorize]
	public Task<IActionResult> Restore(Guid postId, CancellationToken cancellationToken)
		=> Moderate(postId, isPinned: null, isLocked: null, isHidden: false, cancellationToken);

	private async Task<IActionResult> Moderate(
		Guid postId,
		bool? isPinned,
		bool? isLocked,
		bool? isHidden,
		CancellationToken cancellationToken)
	{
		var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
		if (currentMemberId is null)
		{
			return Unauthorized();
		}

		var result = await mediator.Send(
			new SetForumPostModerationCommand(postId, currentMemberId.Value, isPinned, isLocked, isHidden),
			cancellationToken);

		this.ApplyPrivateNoCacheHeaders();
		return this.ToActionResult(result);
	}

	public sealed record ForumPostRequest(
		Guid CategoryId,
		Guid? GroupId,
		IReadOnlyDictionary<string, string> Title,
		IReadOnlyDictionary<string, string> Body,
		IReadOnlyList<ForumMediaInput>? Media,
		ForumPostVisibility Visibility = ForumPostVisibility.MembersOnly);

	public sealed record ForumCommentRequest(
		IReadOnlyDictionary<string, string>? Body,
		Guid? ParentCommentId = null,
		IReadOnlyList<ForumMediaInput>? Media = null,
		ForumCommentVisibility? Visibility = null);
}
