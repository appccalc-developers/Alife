using Alife.Api.Http;
using Alife.Api.Results;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Controllers;

[ApiController]
[Route("api/event-package-delegations")]
[Authorize]
public sealed class EventPackageDelegationsController(IEventPackageDelegationService delegations, ICurrentMemberAccessor currentMemberAccessor)
    : ControllerBase
{
    [HttpGet]
    public Task<IActionResult> List([FromQuery] Guid organisationId, CancellationToken ct)
        => Run(member => delegations.ListAsync(organisationId, member, ct));

    [HttpPost]
    public Task<IActionResult> Grant(GrantEventPackageApprovalDelegationRequest request, CancellationToken ct)
        => Run(member => delegations.GrantAsync(member, request, Request.Headers["Idempotency-Key"].ToString(), ct));

    [HttpPost("{delegationId:guid}/revoke")]
    public Task<IActionResult> Revoke(Guid delegationId, RevokeEventPackageApprovalDelegationRequest request, CancellationToken ct)
        => Run(member => delegations.RevokeAsync(delegationId, member, request, Request.Headers.IfMatch.ToString(),
            Request.Headers["Idempotency-Key"].ToString(), ct));

    private async Task<IActionResult> Run<T>(Func<Guid, Task<Alife.Application.Common.Models.AppResult<T>>> action)
    {
        this.ApplyPrivateNoStoreHeaders();
        var member = currentMemberAccessor.GetCurrentMemberId();
        return member.HasValue ? this.ToActionResult(await action(member.Value)) : Unauthorized();
    }
}
