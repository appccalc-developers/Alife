using Alife.Api.Http;
using Alife.Api.Results;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Controllers;

[ApiController, Authorize, Route("api/events/{eventId:guid}/activity-project-configurations")]
public sealed class EventActivityModuleConfigurationsController(
    EventActivityModuleConfigurationService configurations, ICurrentMemberAccessor current) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(Guid eventId, CancellationToken ct)
    {
        this.ApplyNoStoreHeaders();
        return current.GetCurrentMemberId() is { } actor
            ? this.ToActionResult(await configurations.GetAsync(eventId, actor, ct)) : Unauthorized();
    }

    [HttpPut("projects/{activityId}/{kind}")]
    public async Task<IActionResult> Save(Guid eventId, string activityId, string kind,
        SaveProjectModuleConfigurationRequest request, CancellationToken ct)
    {
        this.ApplyNoStoreHeaders();
        return current.GetCurrentMemberId() is { } actor
            ? this.ToActionResult(await configurations.SaveAsync(eventId, activityId, kind, actor,
                request, Request.Headers.IfMatch.ToString(), ct)) : Unauthorized();
    }
}
