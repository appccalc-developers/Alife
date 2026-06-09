using Alife.Api.Results;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Admin.Commands.RefreshCloudflareCache;
using Alife.Application.Admin.Commands.SyncSermons;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Controllers;

[ApiController]
[Route("api/admin")]
[Authorize]
public class AdminController(IMediator mediator, ICurrentMemberAccessor currentMemberAccessor) : ControllerBase
{
    [HttpPost("sermons/sync")]
    public async Task<IActionResult> SyncSermons(CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(new SyncSermonsCommand(currentMemberId.Value), cancellationToken);
        return this.ToActionResult(result);
    }

    [HttpPost("groups/{groupId:guid}/cloudflare-cache/refresh")]
    public async Task<IActionResult> RefreshCloudflareCache(Guid groupId, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(
            new RefreshCloudflareCacheCommand(currentMemberId.Value, groupId),
            cancellationToken);
        return this.ToActionResult(result);
    }
}
