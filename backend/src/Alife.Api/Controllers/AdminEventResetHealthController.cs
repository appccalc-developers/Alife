using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Controllers;

[ApiController]
[Route("api/admin/events/reset-health")]
[AllowAnonymous]
public sealed class AdminEventResetHealthController(EventResetHealthState healthState) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        Response.Headers.CacheControl = "private, no-store";
        Response.Headers.Pragma = "no-cache";
        if (!healthState.IsHealthIdentity(Request.Headers.Authorization.ToString()))
            return StatusCode(StatusCodes.Status403Forbidden, new { healthy = false });

        try
        {
            var status = await healthState.ReadAsync(cancellationToken);
            return status.Healthy ? Ok(status) : StatusCode(StatusCodes.Status503ServiceUnavailable, status);
        }
        catch
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { healthy = false });
        }
    }
}
