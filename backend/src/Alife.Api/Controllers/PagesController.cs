using Alife.Api.Http;
using Alife.Api.Results;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Pages.Commands.CreateGroupPage;
using Alife.Application.Pages.Commands.DeletePage;
using Alife.Application.Pages.Commands.PublishPage;
using Alife.Application.Pages.Commands.UpdatePage;
using Alife.Application.Pages.Queries.GetGlobalPages;
using Alife.Application.Pages.Queries.GetGroupPages;
using Alife.Application.Pages.Queries.GetPageBySlug;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Alife.Api.Controllers;

[ApiController]
[Route("api")]
[Authorize]
public class PagesController(
    IMediator mediator,
    ICurrentMemberAccessor currentMemberAccessor,
    AlifeDbContext dbContext) : ControllerBase
{
    [HttpGet("pages/global")]
    [AllowAnonymous]
    public async Task<IActionResult> GlobalPages([FromQuery] string lang = "en", CancellationToken cancellationToken = default)
    {
        var updatedUtc = await dbContext.Pages
            .IgnoreQueryFilters()
            .Where(x => x.Scope == PageScope.Global && x.Language == lang)
            .MaxAsync(x => (DateTime?)x.UpdatedUtc, cancellationToken);
        if (this.IsNotModified(updatedUtc))
        {
            return StatusCode(StatusCodes.Status304NotModified);
        }

        var result = await mediator.Send(new GetGlobalPagesQuery(lang), cancellationToken);
        this.ApplySyncCacheHeaders(updatedUtc);
        return this.ToActionResult(result);
    }

    [HttpGet("pages/{slug}")]
    public async Task<IActionResult> GetBySlug(string slug, [FromQuery] string lang = "en", CancellationToken cancellationToken = default)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var updatedUtc = await dbContext.Pages
            .IgnoreQueryFilters()
            .Where(x => x.Slug == slug && x.Language == lang)
            .MaxAsync(x => (DateTime?)x.UpdatedUtc, cancellationToken);
        if (this.IsNotModified(updatedUtc))
        {
            return StatusCode(StatusCodes.Status304NotModified);
        }

        var result = await mediator.Send(new GetPageBySlugQuery(slug, lang, currentMemberId.Value), cancellationToken);
        this.ApplySyncCacheHeaders(updatedUtc);
        return this.ToActionResult(result);
    }

    [HttpGet("groups/{groupId:guid}/pages")]
    public async Task<IActionResult> GroupPages(Guid groupId, [FromQuery] string lang = "en", CancellationToken cancellationToken = default)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var updatedUtc = await dbContext.Pages
            .IgnoreQueryFilters()
            .Where(x => x.Scope == PageScope.Group && x.OwnerGroupId == groupId && x.Language == lang)
            .MaxAsync(x => (DateTime?)x.UpdatedUtc, cancellationToken);
        if (this.IsNotModified(updatedUtc))
        {
            return StatusCode(StatusCodes.Status304NotModified);
        }

        var result = await mediator.Send(new GetGroupPagesQuery(groupId, lang, currentMemberId.Value), cancellationToken);
        this.ApplySyncCacheHeaders(updatedUtc);
        return this.ToActionResult(result);
    }

    [HttpPost("groups/{groupId:guid}/pages")]
    public async Task<IActionResult> CreateGroupPage(Guid groupId, [FromBody] CreatePageRequest request, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(
            new CreateGroupPageCommand(
                groupId,
                currentMemberId.Value,
                request.Title,
                request.Slug,
                request.Language,
                request.Description,
                request.TagsJson,
                request.TitleDisplayStyle),
            cancellationToken);

        return this.ToActionResult(result);
    }

    [HttpPut("pages/{id:guid}")]
    public async Task<IActionResult> UpdatePage(Guid id, [FromBody] UpdatePageRequest request, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(
            new UpdatePageCommand(id, currentMemberId.Value, request.Title, request.Description, request.TagsJson, request.TitleDisplayStyle),
            cancellationToken);

        return this.ToActionResult(result);
    }

    [HttpPost("pages/{id:guid}/publish")]
    public async Task<IActionResult> PublishPage(Guid id, [FromBody] PublishRequest request, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(new PublishPageCommand(id, currentMemberId.Value, request.Visibility), cancellationToken);
        return this.ToActionResult(result);
    }

    [HttpDelete("pages/{id:guid}")]
    public async Task<IActionResult> DeletePage(Guid id, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(new DeletePageCommand(id, currentMemberId.Value), cancellationToken);
        return this.ToActionResult(result);
    }

    public record CreatePageRequest(string Title, string Slug, string Language, string? Description, string? TagsJson, string? TitleDisplayStyle);
    public record UpdatePageRequest(string Title, string? Description, string? TagsJson, string? TitleDisplayStyle);
    public record PublishRequest(PageVisibility Visibility);
}
