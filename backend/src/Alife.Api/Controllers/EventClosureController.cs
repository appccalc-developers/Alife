using Alife.Api.Http;
using Alife.Api.Results;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Events.Commands.UpdateEventClosureReport;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Queries.GetEventClosureWorkspace;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Controllers;

[ApiController]
[Route("api/events/{eventId:guid}/closure")]
[Authorize]
public sealed class EventClosureController(IMediator mediator, ICurrentMemberAccessor currentMemberAccessor) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(Guid eventId, CancellationToken cancellationToken)
    {
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        var result = await mediator.Send(new GetEventClosureWorkspaceQuery(eventId, memberId.Value), cancellationToken);
        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpPut]
    public async Task<IActionResult> Update(Guid eventId, [FromBody] UpdateEventClosureRequest request, CancellationToken cancellationToken)
    {
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        return this.ToActionResult(await mediator.Send(new UpdateEventClosureReportCommand(
            eventId, memberId.Value, request.SummaryEn, request.SummaryZh, request.AttendanceNotes,
            request.FinanceNotes, request.IncidentNotes, request.FollowUpNotes,
            request.Learnings ?? [], request.LeaderConfirmed), cancellationToken));
    }

    public sealed record UpdateEventClosureRequest(
        string SummaryEn, string SummaryZh, string AttendanceNotes, string FinanceNotes,
        string IncidentNotes, string FollowUpNotes, IReadOnlyList<EventClosureLearningDto>? Learnings,
        bool LeaderConfirmed);
}
