using Alife.Api.Http;
using Alife.Api.Results;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Events.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Controllers;

[ApiController, Authorize, Route("api/events/{eventId:guid}/reports/{moduleCode}")]
public sealed class EventReportsController(EventModuleReportService reports, ICurrentMemberAccessor current) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(Guid eventId, string moduleCode, CancellationToken ct)
    {
        this.ApplyNoStoreHeaders();
        if (current.GetCurrentMemberId() is not { } actor) return Unauthorized();
        var result = await reports.GetAsync(eventId, moduleCode, actor, ct);
        if (result.IsSuccess) Response.Headers.ETag = result.Value!.ETag;
        return this.ToActionResult(result);
    }
    [HttpPost("{operation:regex(^(save|submit|withdraw|return|adopt)$)}")]
    public async Task<IActionResult> Act(Guid eventId, string moduleCode, string operation, EventReportRequest request, CancellationToken ct)
    {
        this.ApplyNoStoreHeaders();
        if (current.GetCurrentMemberId() is not { } actor) return Unauthorized();
        var result = await reports.ActAsync(eventId, moduleCode, actor, operation, request, Request.Headers.IfMatch.ToString(), Request.Headers["Idempotency-Key"].ToString(), ct);
        if (result.IsSuccess) Response.Headers.ETag = result.Value!.ETag;
        return this.ToActionResult(result);
    }
}
