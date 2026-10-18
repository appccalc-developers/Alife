using Alife.Api.Results;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Albums;
using Alife.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Controllers;

[ApiController]
[Route("api")]
public sealed class AlbumPhotosController(AlbumPhotoService photos, ICurrentMemberAccessor member) : ControllerBase
{
    // Compatibility for historical original URLs. The Worker forwards the viewer's
    // credentials; this endpoint still checks the current owning album on every read.
    [HttpGet("album-photo-objects")]
    [AllowAnonymous]
    public async Task<IActionResult> ReadByKey([FromQuery] string key, CancellationToken ct)
    {
        PrivateHeaders();
        var result = await photos.ReadByKeyAsync(key, member.GetCurrentMemberId(), ct);
        return result.IsSuccess ? File(result.Value!.Stream, result.Value.ContentType) : this.ToActionResult(result);
    }
    [HttpGet("album-photos/{assetId:guid}")]
    [AllowAnonymous]
    public async Task<IActionResult> Read(Guid assetId, CancellationToken ct)
    {
        PrivateHeaders();
        var result = await photos.ReadAsync(assetId, member.GetCurrentMemberId(), ct);
        return result.IsSuccess ? File(result.Value!.Stream, result.Value.ContentType) : this.ToActionResult(result);
    }

    [HttpPost("albums/{albumId:guid}/photo-upload")]
    [Authorize]
    [RequestSizeLimit(AlbumPhotoService.MaxBytes + 65536)]
    [RequestFormLimits(MultipartBodyLengthLimit = AlbumPhotoService.MaxBytes + 65536)]
    public async Task<IActionResult> Upload(Guid albumId, IFormFile file, [FromForm, Microsoft.AspNetCore.Mvc.ModelBinding.BindRequired] Guid uploadId,
        [FromForm, Microsoft.AspNetCore.Mvc.ModelBinding.BindRequired] AlbumVisibility expectedVisibility, CancellationToken ct)
    {
        PrivateHeaders();
        if (member.GetCurrentMemberId() is not { } actor) return Unauthorized();
        if (file.Length is <= 0 or > AlbumPhotoService.MaxBytes) return BadRequest();
        using var buffer = new MemoryStream();
        await file.CopyToAsync(buffer, ct);
        var result = await photos.UploadAsync(albumId, actor, uploadId, expectedVisibility, file.FileName,
            new(buffer.ToArray(), file.ContentType), ct);
        return result.IsSuccess ? Ok(new { fileAssetId = result.Value }) : this.ToActionResult(result);
    }

    private void PrivateHeaders()
    {
        Response.Headers.CacheControl = "private, no-store";
        Response.Headers.Pragma = "no-cache";
        Response.Headers.Vary = "Cookie, Authorization";
        Response.Headers["X-Content-Type-Options"] = "nosniff";
        Response.Headers["Referrer-Policy"] = "no-referrer";
        Response.Headers["Content-Security-Policy"] = "default-src 'none'; sandbox";
    }
}
