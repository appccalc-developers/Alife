using Alife.Api.Http;
using Alife.Api.Results;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Events.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Controllers;

[ApiController, Authorize, Route("api/events/ram-authoring")]
public sealed class EventRamAuthoringController(EventRamGovernanceService ram, ICurrentMemberAccessor members) : ControllerBase
{
    [HttpGet("access")]
    public async Task<IActionResult> Access(Guid? eventId, Guid? groupId, CancellationToken ct)
    {
        this.ApplyPrivateNoStoreHeaders();
        var actor = members.GetCurrentMemberId();
        if (!actor.HasValue) return Unauthorized();
        var result = await ram.AuthoringContextAsync(eventId, groupId, actor.Value, ct);
        return result.IsSuccess ? Ok(new { result.Value!.SourceVersion }) : this.ToActionResult(result);
    }
    [HttpGet("context")]
    public async Task<IActionResult> Context(Guid? eventId, Guid? groupId, CancellationToken ct)
    {
        this.ApplyPrivateNoStoreHeaders();
        var actor = members.GetCurrentMemberId();
        return actor.HasValue ? this.ToActionResult(await ram.AuthoringContextAsync(eventId, groupId, actor.Value, ct)) : Unauthorized();
    }

    [HttpPost("check"), RequestSizeLimit(1_000_000)]
    public async Task<IActionResult> Check(RamDraftCheckRequest request, CancellationToken ct)
    {
        this.ApplyPrivateNoStoreHeaders();
        var actor = members.GetCurrentMemberId();
        return actor.HasValue ? this.ToActionResult(await ram.CheckDraftAsync(request, actor.Value, ct)) : Unauthorized();
    }
}
