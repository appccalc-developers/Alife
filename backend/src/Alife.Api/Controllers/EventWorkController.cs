using Alife.Api.Http;
using Alife.Api.Results;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Events.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
namespace Alife.Api.Controllers;

[ApiController, Authorize, Route("api/events")]
public sealed class EventWorkController(EventWorkService work, ICurrentMemberAccessor current) : ControllerBase
{
    [HttpGet("work")]
    public async Task<IActionResult> List(CancellationToken ct, [FromQuery] int page = 1, [FromQuery] string? search = null)
    {
        this.ApplyNoStoreHeaders();
        return current.GetCurrentMemberId() is { } actor ? Ok(await work.ListAsync(actor, page, search, ct)) : Unauthorized();
    }
    [HttpGet("{eventId:guid}/work")]
    public async Task<IActionResult> Get(Guid eventId, CancellationToken ct, [FromQuery] int page = 1)
    {
        this.ApplyNoStoreHeaders();
        return current.GetCurrentMemberId() is { } actor ? this.ToActionResult(await work.GetAsync(eventId, actor, page, ct)) : Unauthorized();
    }
}
