using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Controllers;

[ApiController]
[Route("api/admin/events/reset-status")]
[AllowAnonymous]
public sealed class AdminEventResetStatusController(
    EventWriteFreezeState freezeState,
    IEventResetTargetIdentityProbe targetIdentityProbe) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        Response.Headers.CacheControl = "private, no-store";
        Response.Headers.Pragma = "no-cache";
        if (!freezeState.IsMaintenanceIdentity(Request.Headers.Authorization.ToString()))
            return StatusCode(StatusCodes.Status403Forbidden, new { ready = false, frozen = false });
        try
        {
            var targetIdentityHash = await targetIdentityProbe.ReadAsync(cancellationToken);
            return Ok(freezeState.GetStatus() with { TargetIdentityHash = targetIdentityHash });
        }
        catch
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { ready = false, frozen = true });
        }
    }
}
