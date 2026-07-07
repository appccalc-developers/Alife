using Alife.Api.Http;
using Alife.Api.Results;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Forum.Commands.CreateSermonForumComment;
using Alife.Application.Forum.Queries.GetSermonForumPost;
using Alife.Application.Forum.Services;
using Alife.Application.Sermons.Queries.GetSermonById;
using Alife.Application.Sermons.Queries.GetSermons;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Controllers;

[ApiController]
[Route("api")]
[Authorize]
public class SermonsController(
    IMediator mediator,
    ICurrentMemberAccessor currentMemberAccessor) : ControllerBase
{
    [HttpGet("sermons")]
    [AllowAnonymous]
    public async Task<IActionResult> GetSermons(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 12,
        CancellationToken cancellationToken = default)
    {
        var result = await mediator.Send(
            new GetSermonsQuery(page <= 0 ? 1 : page, pageSize <= 0 ? 12 : pageSize),
            cancellationToken);
        this.ApplyPublicCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpGet("sermons/{sermonId:guid}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetSermonById(Guid sermonId, CancellationToken cancellationToken)
    {
        var result = await mediator.Send(new GetSermonByIdQuery(sermonId), cancellationToken);
        this.ApplyPublicCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpGet("sermons/{sermonId:guid}/forum-post")]
    [AllowAnonymous]
    public async Task<IActionResult> GetSermonForumPost(Guid sermonId, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        var result = await mediator.Send(new GetSermonForumPostQuery(sermonId, currentMemberId), cancellationToken);

        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpPost("sermons/{sermonId:guid}/comments")]
    public async Task<IActionResult> CreateSermonComment(
        Guid sermonId,
        [FromBody] SermonCommentRequest request,
        CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(
            new CreateSermonForumCommentCommand(sermonId, currentMemberId.Value, request.ParentCommentId, request.Body, request.Media),
            cancellationToken);

        if (!result.IsSuccess)
        {
            return this.ToActionResult(result);
        }

        this.ApplyPrivateNoCacheHeaders();
        return CreatedAtAction(nameof(GetSermonForumPost), new { sermonId }, result.Value);
    }

    public sealed record SermonCommentRequest(
        IReadOnlyDictionary<string, string>? Body,
        Guid? ParentCommentId = null,
        IReadOnlyList<ForumMediaInput>? Media = null);
}
