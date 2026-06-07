using Alife.Api.Http;
using Alife.Api.Results;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Pages.Commands.CreateGroupPage;
using Alife.Application.Pages.Commands.DeletePage;
using Alife.Application.Pages.Commands.PublishPage;
using Alife.Application.Pages.Commands.UpdatePage;
using Alife.Application.Pages.Queries.GetGlobalPages;
using Alife.Application.Pages.Queries.GetGroupPages;
using Alife.Application.Pages.Queries.GetPageById;
using Alife.Application.Pages.Dtos;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Controllers;

[ApiController]
[Route("api")]
[Authorize]
public class PagesController(
    IMediator mediator,
    ICurrentMemberAccessor currentMemberAccessor) : ControllerBase
{
    [HttpGet("pages/global")]
    [AllowAnonymous]
    public async Task<IActionResult> GlobalPages(CancellationToken cancellationToken = default)
    {
        var result = await mediator.Send(new GetGlobalPagesQuery(), cancellationToken);
        this.ApplyPublicCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpGet("pages/{id:guid}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetById(Guid id, CancellationToken cancellationToken = default)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();

        var result = await mediator.Send(new GetPageByIdQuery(id, currentMemberId), cancellationToken);
        if (!result.IsSuccess)
        {
            return this.ToActionResult(result);
        }

        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpGet("groups/{groupId:guid}/pages")]
    [AllowAnonymous]
    public async Task<IActionResult> GroupPages(Guid groupId, CancellationToken cancellationToken = default)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();

        var result = await mediator.Send(new GetGroupPagesQuery(groupId, currentMemberId), cancellationToken);
        if (!result.IsSuccess)
        {
            return this.ToActionResult(result);
        }

        this.ApplyPrivateNoCacheHeaders();
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
                request.Description,
                request.TagsJson,
                request.TitleDisplayStyle,
                request.Sections),
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
            new UpdatePageCommand(id, currentMemberId.Value, request.Title, request.Description, request.TagsJson, request.TitleDisplayStyle, request.Sections),
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

    public record CreatePageRequest(
        IReadOnlyDictionary<string, string> Title,
        IReadOnlyDictionary<string, string>? Description,
        string? TagsJson,
        string? TitleDisplayStyle,
        IReadOnlyList<PageSectionDto> Sections);

    public record UpdatePageRequest(
        IReadOnlyDictionary<string, string> Title,
        IReadOnlyDictionary<string, string>? Description,
        string? TagsJson,
        string? TitleDisplayStyle,
        IReadOnlyList<PageSectionDto> Sections);
    public record PublishRequest(PageVisibility Visibility);
}
