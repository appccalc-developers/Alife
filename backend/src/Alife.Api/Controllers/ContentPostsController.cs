using Alife.Api.Http;
using Alife.Api.Results;
using Alife.Application.Abstractions.Identity;
using Alife.Application.ContentPosts.Commands.BulkImportContentPosts;
using Alife.Application.ContentPosts.Commands.ArchiveContentPost;
using Alife.Application.ContentPosts.Commands.DeleteContentPost;
using Alife.Application.ContentPosts.Commands.PublishContentPost;
using Alife.Application.ContentPosts.Commands.SaveContentPost;
using Alife.Application.ContentPosts.Queries.GetPublicContentPostBySlug;
using Alife.Application.ContentPosts.Queries.GetPublicContentPosts;
using Alife.Application.ContentPosts.Queries.ListManagedContentPosts;
using Alife.Application.ContentPosts.Dtos;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Controllers;

[ApiController]
[Route("api")]
[Authorize]
public sealed class ContentPostsController(
    IMediator mediator,
    ICurrentMemberAccessor currentMemberAccessor) : ControllerBase
{
    [HttpGet("public/groups/{groupId:guid}/posts")]
    [AllowAnonymous]
    public async Task<IActionResult> ListPublic(
        Guid groupId,
        CancellationToken cancellationToken)
    {
        var result = await mediator.Send(
            new GetPublicContentPostsQuery(groupId),
            cancellationToken);
        this.ApplyPublicCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpGet("public/groups/{groupId:guid}/posts/{slug}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetPublicBySlug(
        Guid groupId,
        string slug,
        CancellationToken cancellationToken)
    {
        var result = await mediator.Send(
            new GetPublicContentPostBySlugQuery(groupId, slug),
            cancellationToken);
        this.ApplyPublicCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpGet("groups/{groupId:guid}/posts/manage")]
    public async Task<IActionResult> ListManaged(
        Guid groupId,
        CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (!currentMemberId.HasValue)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(
            new ListManagedContentPostsQuery(groupId, currentMemberId.Value),
            cancellationToken);
        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpPost("groups/{groupId:guid}/posts")]
    public Task<IActionResult> Create(
        Guid groupId,
        [FromBody] SaveContentPostRequest request,
        CancellationToken cancellationToken)
        => Save(null, groupId, request, cancellationToken);

    [HttpPost("groups/{groupId:guid}/posts/import")]
    [RequestSizeLimit(30 * 1024 * 1024)]
    public async Task<IActionResult> BulkImport(
        Guid groupId,
        [FromBody] BulkImportContentPostsRequest request,
        CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (!currentMemberId.HasValue)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(
            new BulkImportContentPostsCommand(
                groupId,
                currentMemberId.Value,
                request.DryRun ?? true,
                request.Publish ?? false,
                request.UpdateChanged ?? false,
                request.Items ?? []),
            cancellationToken);
        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpPut("posts/{id:guid}")]
    public Task<IActionResult> Update(
        Guid id,
        [FromBody] SaveContentPostRequest request,
        CancellationToken cancellationToken)
        => Save(id, request.OwnerGroupId, request, cancellationToken);

    [HttpPost("posts/{id:guid}/publish")]
    public async Task<IActionResult> Publish(
        Guid id,
        CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (!currentMemberId.HasValue)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(
            new PublishContentPostCommand(id, currentMemberId.Value),
            cancellationToken);
        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpPost("posts/{id:guid}/archive")]
    public async Task<IActionResult> Archive(
        Guid id,
        CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (!currentMemberId.HasValue)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(
            new ArchiveContentPostCommand(id, currentMemberId.Value),
            cancellationToken);
        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpDelete("posts/{id:guid}")]
    public async Task<IActionResult> Delete(
        Guid id,
        CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (!currentMemberId.HasValue)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(
            new DeleteContentPostCommand(id, currentMemberId.Value),
            cancellationToken);
        this.ApplyPrivateNoCacheHeaders();
        return result.IsSuccess ? NoContent() : this.ToActionResult(result);
    }

    private async Task<IActionResult> Save(
        Guid? id,
        Guid groupId,
        SaveContentPostRequest request,
        CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (!currentMemberId.HasValue)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(
            new SaveContentPostCommand(
                id,
                groupId,
                currentMemberId.Value,
                request.Title,
                request.Summary,
                request.Body,
                request.Category,
                request.Visibility,
                request.Slug,
                request.CoverImageUrl,
                request.Byline,
                request.PublishedUtc,
                request.SourceUrl,
                request.SourceKey,
                request.SourceChecksum),
            cancellationToken);

        this.ApplyPrivateNoCacheHeaders();
        return id.HasValue
            ? this.ToActionResult(result)
            : result.IsSuccess
                ? Created($"/api/posts/{result.Value!.Id}", result.Value)
                : this.ToActionResult(result);
    }

    public sealed record SaveContentPostRequest(
        Guid OwnerGroupId,
        IReadOnlyDictionary<string, string> Title,
        IReadOnlyDictionary<string, string> Summary,
        IReadOnlyDictionary<string, string> Body,
        ContentPostCategory Category,
        ContentPostVisibility Visibility,
        string? Slug,
        string? CoverImageUrl,
        string? Byline,
        DateTime? PublishedUtc,
        string? SourceUrl,
        string? SourceKey,
        string? SourceChecksum);

    public sealed record BulkImportContentPostsRequest(
        bool? DryRun,
        bool? Publish,
        bool? UpdateChanged,
        IReadOnlyList<ContentPostImportItemDto>? Items);
}
