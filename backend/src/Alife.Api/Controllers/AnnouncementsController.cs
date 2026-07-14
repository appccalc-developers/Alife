using Alife.Api.Http;
using Alife.Api.Results;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Announcements.Commands.DeleteAnnouncement;
using Alife.Application.Announcements.Commands.SaveAnnouncement;
using Alife.Application.Announcements.Queries.ListActiveAnnouncements;
using Alife.Application.Announcements.Queries.ListManagedAnnouncements;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Controllers;

[ApiController]
[Route("api")]
[Authorize]
public sealed class AnnouncementsController(IMediator mediator, ICurrentMemberAccessor currentMemberAccessor) : ControllerBase
{
    [HttpGet("groups/{groupId:guid}/announcements")]
    [AllowAnonymous]
    public async Task<IActionResult> ListActive(Guid groupId, CancellationToken cancellationToken)
    {
        var result = await mediator.Send(new ListActiveAnnouncementsQuery(groupId, currentMemberAccessor.GetCurrentMemberId()), cancellationToken);
        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpGet("groups/{groupId:guid}/announcements/manage")]
    public async Task<IActionResult> ListManaged(Guid groupId, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (!currentMemberId.HasValue) return Unauthorized();
        var result = await mediator.Send(new ListManagedAnnouncementsQuery(groupId, currentMemberId.Value), cancellationToken);
        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpPost("groups/{groupId:guid}/announcements")]
    public Task<IActionResult> Create(Guid groupId, [FromBody] SaveAnnouncementRequest request, CancellationToken cancellationToken) =>
        Save(null, groupId, request, cancellationToken);

    [HttpPut("announcements/{id:guid}")]
    public Task<IActionResult> Update(Guid id, [FromBody] SaveAnnouncementRequest request, CancellationToken cancellationToken) =>
        Save(id, request.GroupId, request, cancellationToken);

    [HttpDelete("announcements/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (!currentMemberId.HasValue) return Unauthorized();
        return this.ToActionResult(await mediator.Send(new DeleteAnnouncementCommand(id, currentMemberId.Value), cancellationToken));
    }

    private async Task<IActionResult> Save(Guid? id, Guid groupId, SaveAnnouncementRequest request, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (!currentMemberId.HasValue) return Unauthorized();
        var result = await mediator.Send(new SaveAnnouncementCommand(
            id, groupId, currentMemberId.Value, request.Title, request.Summary, request.Content,
            request.Audience, request.Priority, request.Status, request.PublishUtc, request.ExpireUtc,
            request.IsPinned, request.CreateNotifications), cancellationToken);
        return id.HasValue ? this.ToActionResult(result) : result.IsSuccess ? Created($"/api/announcements/{result.Value!.Id}", result.Value) : this.ToActionResult(result);
    }

    public sealed record SaveAnnouncementRequest(
        Guid GroupId,
        Dictionary<string, string> Title,
        Dictionary<string, string> Summary,
        Dictionary<string, string>? Content,
        AnnouncementAudience Audience,
        AnnouncementPriority Priority,
        AnnouncementStatus Status,
        DateTime PublishUtc,
        DateTime? ExpireUtc,
        bool IsPinned,
        bool CreateNotifications = false);
}
