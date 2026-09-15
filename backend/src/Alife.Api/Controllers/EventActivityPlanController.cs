using Alife.Api.Http;
using Alife.Api.Results;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Common.Models;
using Alife.Application.Events.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Controllers;
[ApiController, Authorize, Route("api/events/{eventId:guid}/activity-plan")]
public sealed class EventActivityPlanController(EventActivityPlanService plans, ICurrentMemberAccessor members) : ControllerBase
{
    [HttpGet] public Task<IActionResult> Get(Guid eventId, CancellationToken ct) => Run(a => plans.GetAsync(eventId,a,ct));
    [HttpPut] public Task<IActionResult> Save(Guid eventId, SaveActivityPlanRequest request, CancellationToken ct) => Run(a => plans.SaveAsync(eventId,a,request,ct));
    private async Task<IActionResult> Run<T>(Func<Guid,Task<AppResult<T>>> action)
    {
        this.ApplyPrivateNoStoreHeaders();
        var actor = members.GetCurrentMemberId();
        return actor.HasValue ? this.ToActionResult(await action(actor.Value)) : Unauthorized();
    }
}
