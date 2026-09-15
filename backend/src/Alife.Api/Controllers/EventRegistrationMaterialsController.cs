using Alife.Api.Http;
using Alife.Api.Results;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Events.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
namespace Alife.Api.Controllers;
[ApiController, Authorize, Route("api/events/{eventId:guid}/registration-work/participants/{participantId:guid}/materials")]
public sealed class EventRegistrationMaterialsController(EventRegistrationMaterialService materials, ICurrentMemberAccessor current) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(Guid eventId, Guid participantId, CancellationToken ct)
    {
        this.ApplyNoStoreHeaders(); return current.GetCurrentMemberId() is { } actor ? this.ToActionResult(await materials.ListAsync(eventId, participantId, actor, ct)) : Unauthorized();
    }
    [HttpPost("{requirementId}")]
    [RequestSizeLimit(EventRegistrationMaterialService.MaxBytes + 65536), RequestFormLimits(MultipartBodyLengthLimit = EventRegistrationMaterialService.MaxBytes + 65536)]
    public async Task<IActionResult> Upload(Guid eventId, Guid participantId, string requirementId, IFormFile file, CancellationToken ct)
    {
        this.ApplyNoStoreHeaders(); if (current.GetCurrentMemberId() is not { } actor) return Unauthorized();
        if (file.Length > EventRegistrationMaterialService.MaxBytes) return BadRequest(new { message = "Upload a file up to 20 MB." });
        using var buffer = new MemoryStream(); await file.CopyToAsync(buffer, ct);
        return this.ToActionResult(await materials.UploadAsync(eventId, participantId, requirementId, actor, file.FileName, buffer.ToArray(), Request.Headers.IfMatch.ToString(), ct));
    }
}
