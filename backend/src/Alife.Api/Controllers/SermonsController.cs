using Alife.Api.Results;
using Alife.Application.Sermons.Queries.GetSermons;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Controllers;

[ApiController]
[Route("api")]
[Authorize]
public class SermonsController(IMediator mediator) : ControllerBase
{
    [HttpGet("sermons")]
    [AllowAnonymous]
    public async Task<IActionResult> GetSermons(CancellationToken cancellationToken)
    {
        var result = await mediator.Send(new GetSermonsQuery(), cancellationToken);
        return this.ToActionResult(result);
    }
}
