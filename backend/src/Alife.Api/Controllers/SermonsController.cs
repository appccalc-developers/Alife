using Alife.Api.Http;
using Alife.Api.Results;
using Alife.Application.Sermons.Queries.GetSermons;
using Alife.Infrastructure.Persistence;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Alife.Api.Controllers;

[ApiController]
[Route("api")]
[Authorize]
public class SermonsController(IMediator mediator, AlifeDbContext dbContext) : ControllerBase
{
    [HttpGet("sermons")]
    [AllowAnonymous]
    public async Task<IActionResult> GetSermons(CancellationToken cancellationToken)
    {
        var updatedUtc = await dbContext.Sermons
            .IgnoreQueryFilters()
            .MaxAsync(x => (DateTime?)x.UpdatedUtc, cancellationToken);
        if (this.IsNotModified(updatedUtc))
        {
            return StatusCode(StatusCodes.Status304NotModified);
        }

        var result = await mediator.Send(new GetSermonsQuery(), cancellationToken);
        this.ApplySyncCacheHeaders(updatedUtc);
        return this.ToActionResult(result);
    }
}
