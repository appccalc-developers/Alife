using Alife.Api.Results;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Sections.Commands.CreateSection;
using Alife.Application.Sections.Commands.DeleteSection;
using Alife.Application.Sections.Commands.ReplaceSectionLinks;
using Alife.Application.Sections.Commands.UpdateSection;
using Alife.Application.Sections.Queries.GetPageSections;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Controllers;

[ApiController]
[Route("api/sections")]
[Authorize]
public class SectionsController(IMediator mediator, ICurrentMemberAccessor currentMemberAccessor) : ControllerBase
{
    [HttpGet("/api/pages/{pageId:guid}/sections")]
    public async Task<IActionResult> GetPageSections(Guid pageId, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(new GetPageSectionsQuery(pageId, currentMemberId.Value), cancellationToken);
        return this.ToActionResult(result);
    }

    [HttpPost("/api/pages/{pageId:guid}/sections")]
    public async Task<IActionResult> CreateSection(Guid pageId, [FromBody] CreateSectionRequest request, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(
            new CreateSectionCommand(pageId, currentMemberId.Value, request.Type, request.ContentJson, request.StyleJson, request.Order),
            cancellationToken);

        return this.ToActionResult(result);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateSection(Guid id, [FromBody] UpdateSectionRequest request, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(
            new UpdateSectionCommand(id, currentMemberId.Value, request.Type, request.ContentJson, request.StyleJson, request.Order),
            cancellationToken);

        return this.ToActionResult(result);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteSection(Guid id, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(new DeleteSectionCommand(id, currentMemberId.Value), cancellationToken);
        return this.ToActionResult(result);
    }

    [HttpPut("{id:guid}/links")]
    public async Task<IActionResult> ReplaceLinks(Guid id, [FromBody] ReplaceLinksRequest request, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(
            new ReplaceSectionLinksCommand(
                id,
                currentMemberId.Value,
                request.Links.Select(x => new ReplaceSectionLinkItem(
                    x.Type,
                    x.TargetGroupId,
                    x.TargetPageId,
                    x.Title,
                    x.ImageUrl,
                    x.SortOrder)).ToList()),
            cancellationToken);

        return this.ToActionResult(result);
    }

    public record CreateSectionRequest(SectionType Type, string? ContentJson, string? StyleJson, int? Order);
    public record UpdateSectionRequest(SectionType Type, string? ContentJson, string? StyleJson, int Order);
    public record ReplaceLinksRequest(List<LinkItemRequest> Links);
    public record LinkItemRequest(LinkType Type, Guid? TargetGroupId, Guid? TargetPageId, string Title, string? ImageUrl, int SortOrder);
}
