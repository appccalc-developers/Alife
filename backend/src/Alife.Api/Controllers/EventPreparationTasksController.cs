using Alife.Api.Http;
using Alife.Api.Results;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Events.Commands.SaveEventPreparationTask;
using Alife.Application.Events.Commands.UpdateEventPreparationTaskStatus;
using Alife.Application.Events.Queries.GetEventPreparationTasks;
using Alife.Application.Events.Queries.GetMyEventPreparationTasks;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Controllers;

[ApiController]
[Route("api/events/{eventId:guid}")]
[Authorize]
public sealed class EventPreparationTasksController(IMediator mediator, ICurrentMemberAccessor currentMemberAccessor) : ControllerBase
{
    [HttpGet("preparation-tasks")]
    public async Task<IActionResult> GetWorkspace(Guid eventId, CancellationToken cancellationToken)
    {
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        var result = await mediator.Send(new GetEventPreparationTasksQuery(eventId, memberId.Value), cancellationToken);
        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpGet("my-preparation-tasks")]
    public async Task<IActionResult> GetMine(Guid eventId, CancellationToken cancellationToken)
    {
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        var result = await mediator.Send(new GetMyEventPreparationTasksQuery(eventId, memberId.Value), cancellationToken);
        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpPost("preparation-tasks")]
    public Task<IActionResult> Create(Guid eventId, [FromBody] SaveTaskRequest request, CancellationToken cancellationToken) =>
        Save(eventId, null, request, cancellationToken);

    [HttpPut("preparation-tasks/{taskId:guid}")]
    public Task<IActionResult> Update(Guid eventId, Guid taskId, [FromBody] SaveTaskRequest request, CancellationToken cancellationToken) =>
        Save(eventId, taskId, request, cancellationToken);

    [HttpPut("preparation-tasks/{taskId:guid}/status")]
    public async Task<IActionResult> UpdateStatus(Guid eventId, Guid taskId, [FromBody] UpdateStatusRequest request, CancellationToken cancellationToken)
    {
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        return this.ToActionResult(await mediator.Send(
            new UpdateEventPreparationTaskStatusCommand(eventId, taskId, memberId.Value, request.Status), cancellationToken));
    }

    private async Task<IActionResult> Save(Guid eventId, Guid? taskId, SaveTaskRequest request, CancellationToken cancellationToken)
    {
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        var result = await mediator.Send(new SaveEventPreparationTaskCommand(
            eventId, taskId, memberId.Value, request.ModuleKey, request.TitleEn, request.TitleZh,
            request.DescriptionEn, request.DescriptionZh, request.AssignedMemberId, request.DueUtc,
            request.IsRequired, request.DependencyTaskIds ?? []), cancellationToken);
        return taskId.HasValue || !result.IsSuccess
            ? this.ToActionResult(result)
            : Created($"/api/events/{eventId}/preparation-tasks/{result.Value!.Id}", result.Value);
    }

    public sealed record SaveTaskRequest(
        string ModuleKey, string TitleEn, string TitleZh, string DescriptionEn, string DescriptionZh,
        Guid? AssignedMemberId, DateTime? DueUtc, bool IsRequired, IReadOnlyList<Guid>? DependencyTaskIds);
    public sealed record UpdateStatusRequest(EventPreparationTaskStatus Status);
}
