using Alife.Api.Http;
using Alife.Api.Results;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Admin.EventPackagePolicies;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Controllers;

[ApiController]
[Route("api/admin/event-package-policies")]
[Authorize]
public sealed class AdminEventPackagePoliciesController(IMediator mediator, ICurrentMemberAccessor currentMemberAccessor)
    : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] Guid? organisationId, CancellationToken ct)
    {
        this.ApplyPrivateNoStoreHeaders();
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        return this.ToActionResult(await mediator.Send(new ListEventPackagePoliciesQuery(memberId.Value, organisationId), ct));
    }

    [HttpPost("publish")]
    public async Task<IActionResult> Publish(PublishEventPackagePolicyRequest request, CancellationToken ct)
    {
        this.ApplyPrivateNoStoreHeaders();
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        return this.ToActionResult(await mediator.Send(new PublishEventPackagePolicyCommand(
            memberId.Value, request, Request.Headers["Idempotency-Key"].ToString()), ct));
    }

    [HttpGet("rollout-report")]
    public async Task<IActionResult> RolloutReport([FromQuery] int windowDays = 30, CancellationToken ct = default)
    {
        this.ApplyPrivateNoStoreHeaders();
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        return this.ToActionResult(await mediator.Send(
            new GetEventPackageRolloutReportQuery(memberId.Value, windowDays), ct));
    }
}
