using Alife.Api.Http;
using Alife.Api.Results;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Admin.Dtos;
using Alife.Application.Admin.EventTemplates;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Controllers;

[ApiController]
[Route("api/admin/event-templates")]
[Authorize]
public sealed class AdminEventTemplatesController(
    IMediator mediator,
    ICurrentMemberAccessor currentMemberAccessor) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] string? search,
        [FromQuery] string? archetypeCode,
        [FromQuery] string? status,
        [FromQuery] string? sortBy,
        [FromQuery] string? sortDirection,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        CancellationToken cancellationToken = default)
    {
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        var result = await mediator.Send(new ListAdminEventActivityTemplatesQuery(
            memberId.Value, search, archetypeCode, status, sortBy, sortDirection, page, pageSize), cancellationToken);
        this.ApplyPrivateNoStoreHeaders();
        return this.ToActionResult(result);
    }

    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] CreateAdminEventActivityTemplateRequest request,
        CancellationToken cancellationToken)
    {
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        var result = await mediator.Send(
            new CreateAdminEventActivityTemplateCommand(memberId.Value, request), cancellationToken);
        this.ApplyPrivateNoStoreHeaders();
        if (result.IsSuccess) Response.Headers.ETag = result.Value!.ETag;
        return this.ToActionResult(result);
    }

    [HttpPut("{code}")]
    public async Task<IActionResult> Update(
        string code,
        [FromBody] UpdateAdminEventActivityTemplateRequest request,
        CancellationToken cancellationToken)
    {
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        var result = await mediator.Send(new UpdateAdminEventActivityTemplateCommand(
            memberId.Value, code, Request.Headers.IfMatch.ToString(), request), cancellationToken);
        this.ApplyPrivateNoStoreHeaders();
        if (result.IsSuccess) Response.Headers.ETag = result.Value!.ETag;
        return this.ToActionResult(result);
    }
}
