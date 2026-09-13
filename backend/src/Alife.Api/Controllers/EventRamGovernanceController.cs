using Alife.Api.Http;
using Alife.Api.Results;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Controllers;

[ApiController, Authorize, Route("api/events/{eventId:guid}/ram")]
public sealed class EventRamGovernanceController(EventRamGovernanceService ram, ICurrentMemberAccessor members) : ControllerBase
{
    [HttpGet("workspace")]
    public Task<IActionResult> Get(Guid eventId,CancellationToken ct) => Run(actor=>ram.GetAsync(eventId,actor,ct));
    [HttpGet("versions/{revisionId:guid}")]
    public Task<IActionResult> Print(Guid eventId,Guid revisionId,CancellationToken ct) => Run(actor=>ram.PrintAsync(eventId,revisionId,actor,ct));
    [HttpPost("actions/{ramAction}")]
    public Task<IActionResult> Act(Guid eventId,string ramAction,RamActionRequest request,CancellationToken ct) =>
        Run(actor=>ram.ActAsync(eventId,actor,ramAction,request,Request.Headers["Idempotency-Key"].ToString(),ct));
    private async Task<IActionResult> Run<T>(Func<Guid,Task<AppResult<T>>> action)
    {
        this.ApplyPrivateNoStoreHeaders();
        var actor=members.GetCurrentMemberId();
        return actor.HasValue?this.ToActionResult(await action(actor.Value)):Unauthorized();
    }
}

[ApiController, Authorize, Route("api/admin/churches/{churchId:guid}/ram-policies")]
public sealed class AdminRamPoliciesController(EventRamGovernanceService ram,ICurrentMemberAccessor members) : ControllerBase
{
    [HttpGet]
    public Task<IActionResult> List(Guid churchId,CancellationToken ct) => Run(actor=>ram.PoliciesAsync(churchId,actor,ct));
    [HttpPut]
    public Task<IActionResult> Save(Guid churchId,RamPolicySaveRequest request,CancellationToken ct) => Run(actor=>ram.SavePolicyAsync(churchId,actor,request,ct));
    [HttpPost("{policyId:guid}/publish")]
    public Task<IActionResult> Publish(Guid churchId,Guid policyId,RamPolicyPublishRequest request,CancellationToken ct) => Run(actor=>ram.PublishPolicyAsync(churchId,policyId,actor,request,ct));
    private async Task<IActionResult> Run<T>(Func<Guid,Task<AppResult<T>>> action)
    {
        this.ApplyPrivateNoStoreHeaders();
        var actor=members.GetCurrentMemberId();
        return actor.HasValue?this.ToActionResult(await action(actor.Value)):Unauthorized();
    }
}
