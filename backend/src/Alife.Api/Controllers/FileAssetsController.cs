using Alife.Api.Results;
using Alife.Application.Abstractions.Identity;
using Alife.Application.FileAssets.Commands.RegisterFileAsset;
using Alife.Application.FileAssets.Queries.GetFileAssetOpenUrl;
using Alife.Application.FileAssets.Queries.ListFileAssets;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Controllers;

[ApiController]
[Route("api/file-assets")]
[Authorize]
public class FileAssetsController(
    IMediator mediator,
    ICurrentMemberAccessor currentMemberAccessor) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] Guid? groupId,
        [FromQuery] FileAssetVisibility? visibility,
        [FromQuery] FileAssetPurpose? purpose,
        [FromQuery] string? relatedEntityType,
        [FromQuery] Guid? relatedEntityId,
        [FromQuery] bool unassignedOnly,
        CancellationToken cancellationToken,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        [FromQuery] FileAssetSortBy sortBy = FileAssetSortBy.UploadedUtc,
        [FromQuery] SortDirection sortDirection = SortDirection.Desc)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(
            new ListFileAssetsQuery(
                currentMemberId.Value,
                groupId,
                visibility,
                purpose,
                relatedEntityType,
                relatedEntityId,
                unassignedOnly,
                page,
                pageSize,
                sortBy,
                sortDirection),
            cancellationToken);

        return this.ToActionResult(result);
    }

    [HttpGet("{fileAssetId:guid}/open")]
    public async Task<IActionResult> Open(Guid fileAssetId, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(
            new GetFileAssetOpenUrlQuery(currentMemberId.Value, fileAssetId),
            cancellationToken);

        if (!result.IsSuccess)
        {
            return this.ToActionResult(result);
        }

        Response.Headers.CacheControl = "no-store, private";
        Response.Headers.Pragma = "no-cache";
        return Redirect(result.Value!);
    }

    [HttpPost]
    public async Task<IActionResult> Register(
        [FromBody] RegisterFileAssetRequest request,
        CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(
            new RegisterFileAssetCommand(
                currentMemberId.Value,
                request.StorageProvider,
                request.BucketName,
                request.ObjectKey,
                request.PublicUrl,
                request.OriginalFileName,
                request.StoredFileName,
                request.ContentType,
                request.SizeBytes,
                request.ETag,
                request.UploadedUtc,
                request.Visibility,
                request.Purpose,
                request.GroupId,
                request.OwnerMemberId,
                request.RelatedEntityType,
                request.RelatedEntityId),
            cancellationToken);

        return result.IsSuccess
            ? StatusCode(StatusCodes.Status201Created, result.Value)
            : this.ToActionResult(result);
    }

    public sealed record RegisterFileAssetRequest(
        string StorageProvider,
        string? BucketName,
        string ObjectKey,
        string? PublicUrl,
        string? OriginalFileName,
        string? StoredFileName,
        string ContentType,
        long SizeBytes,
        string? ETag,
        DateTime? UploadedUtc,
        FileAssetVisibility Visibility,
        FileAssetPurpose Purpose,
        Guid? GroupId,
        Guid? OwnerMemberId,
        string? RelatedEntityType,
        Guid? RelatedEntityId);
}
