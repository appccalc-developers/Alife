using Alife.Api.Http;
using Alife.Api.Results;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Albums;
using Alife.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Controllers;

[ApiController]
[Route("api")]
[Authorize]
public sealed class AlbumsController(IAlbumService albums, ICurrentMemberAccessor currentMemberAccessor) : ControllerBase
{
    [HttpGet("groups/{groupId:guid}/albums")]
    [AllowAnonymous]
    public async Task<IActionResult> List(Guid groupId, [FromQuery] bool includeAll, CancellationToken cancellationToken)
    {
        var result = await albums.ListAsync(groupId, currentMemberAccessor.GetCurrentMemberId(), includeAll, cancellationToken);
        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpGet("albums/{albumId:guid}")]
    [AllowAnonymous]
    public async Task<IActionResult> Get(Guid albumId, CancellationToken cancellationToken)
    {
        var result = await albums.GetAsync(albumId, currentMemberAccessor.GetCurrentMemberId(), cancellationToken);
        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpPost("groups/{groupId:guid}/albums")]
    public async Task<IActionResult> Create(Guid groupId, [FromBody] CreateAlbumRequest request, CancellationToken cancellationToken)
    {
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        var result = await albums.CreateAsync(new CreateAlbumInput(groupId, request.ParentAlbumId, request.Name, request.Description, request.Visibility), memberId.Value, cancellationToken);
        return result.IsSuccess ? Created($"/api/albums/{result.Value!.Album.Id}", result.Value) : this.ToActionResult(result);
    }

    [HttpPost("albums/{albumId:guid}/photos")]
    public async Task<IActionResult> AddPhoto(Guid albumId, [FromBody] AddAlbumPhotoRequest request, CancellationToken cancellationToken)
    {
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        return this.ToActionResult(await albums.AddPhotoAsync(albumId, request.FileAssetId, request.Caption, memberId.Value, cancellationToken));
    }

    [HttpDelete("albums/{albumId:guid}/photos/{photoId:guid}")]
    public async Task<IActionResult> RemovePhoto(Guid albumId, Guid photoId, CancellationToken cancellationToken)
    {
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        return this.ToActionResult(await albums.RemovePhotoAsync(albumId, photoId, memberId.Value, cancellationToken));
    }

    [HttpPut("albums/{albumId:guid}/photos/order")]
    public async Task<IActionResult> Reorder(Guid albumId, [FromBody] ReorderAlbumPhotosRequest request, CancellationToken cancellationToken)
    {
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        return this.ToActionResult(await albums.ReorderPhotosAsync(albumId, request.PhotoIds, memberId.Value, cancellationToken));
    }

    public sealed record CreateAlbumRequest(Guid? ParentAlbumId, Dictionary<string, string> Name, Dictionary<string, string>? Description, AlbumVisibility Visibility);
    public sealed record AddAlbumPhotoRequest(Guid FileAssetId, Dictionary<string, string>? Caption);
    public sealed record ReorderAlbumPhotosRequest(IReadOnlyList<Guid> PhotoIds);
}
