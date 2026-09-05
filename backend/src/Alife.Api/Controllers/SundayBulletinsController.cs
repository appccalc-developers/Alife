using Alife.Api.Http;
using Alife.Api.Results;
using Alife.Application.Abstractions.Identity;
using Alife.Application.ChurchLife;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/church-life/bulletins")]
public sealed class SundayBulletinsController(SundayBulletinService bulletins, ICurrentMemberAccessor member) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken token)
    {
        this.ApplyNoStoreHeaders();
        Response.Headers.CacheControl = "private, no-store";
        if (member.GetCurrentMemberId() is not Guid id) return Unauthorized();
        return this.ToActionResult(await bulletins.ListAsync(id, token));
    }

    [HttpGet("{date}/open")]
    public async Task<IActionResult> Open(DateOnly date, CancellationToken token)
    {
        this.ApplyNoStoreHeaders();
        Response.Headers.CacheControl = "private, no-store";
        if (member.GetCurrentMemberId() is not Guid id) return Unauthorized();
        var result = await bulletins.OpenAsync(id, date, token);
        return result.IsSuccess ? Redirect(result.Value!) : this.ToActionResult(result);
    }

    [HttpPut("{date}")]
    [RequestSizeLimit(SundayBulletinService.MaxPdfBytes + 65536)]
    [RequestFormLimits(MultipartBodyLengthLimit = SundayBulletinService.MaxPdfBytes + 65536)]
    public async Task<IActionResult> Upload(DateOnly date, IFormFile file, CancellationToken token)
    {
        this.ApplyNoStoreHeaders();
        Response.Headers.CacheControl = "private, no-store";
        if (member.GetCurrentMemberId() is not Guid id) return Unauthorized();
        if (file.Length > SundayBulletinService.MaxPdfBytes) return BadRequest(new { message = "Upload a PDF file up to 20 MB." });
        using var buffer = new MemoryStream();
        await file.CopyToAsync(buffer, token);
        return this.ToActionResult(await bulletins.UploadAsync(id, date, file.FileName, buffer.ToArray(), token));
    }
}
