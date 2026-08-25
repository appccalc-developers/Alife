using Alife.Api.Http;
using Alife.Api.Results;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Events.Commands.SaveEventProgrammeItem;
using Alife.Application.Events.Queries.GetEventProgramme;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Controllers;

[ApiController]
[Route("api/events/{eventId:guid}/programme")]
[Authorize]
public sealed class EventProgrammeController(IMediator mediator, ICurrentMemberAccessor currentMemberAccessor) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(Guid eventId, CancellationToken cancellationToken)
    {
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        var result = await mediator.Send(new GetEventProgrammeQuery(eventId, memberId.Value), cancellationToken);
        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpPost("items")]
    public Task<IActionResult> Create(Guid eventId, SaveProgrammeItemRequest request, CancellationToken cancellationToken) =>
        Save(eventId, null, request, cancellationToken);

    [HttpPut("items/{itemId:guid}")]
    public Task<IActionResult> Update(Guid eventId, Guid itemId, SaveProgrammeItemRequest request, CancellationToken cancellationToken) =>
        Save(eventId, itemId, request, cancellationToken);

    private async Task<IActionResult> Save(
        Guid eventId, Guid? itemId, SaveProgrammeItemRequest request, CancellationToken cancellationToken)
    {
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        return this.ToActionResult(await mediator.Send(new SaveEventProgrammeItemCommand(
            eventId, itemId, memberId.Value, request.EventOccurrenceId, request.RosterShiftId,
            request.OwnerMemberId, request.SortOrder, request.StartUtc, request.EndUtc,
            request.TitleEn, request.TitleZh, request.InstructionsEn, request.InstructionsZh,
            request.RequiresHandover, request.HandoverEn, request.HandoverZh, request.Status), cancellationToken));
    }

    public sealed record SaveProgrammeItemRequest(
        Guid? EventOccurrenceId,
        Guid? RosterShiftId,
        Guid? OwnerMemberId,
        int SortOrder,
        DateTime StartUtc,
        DateTime EndUtc,
        string TitleEn,
        string TitleZh,
        string InstructionsEn,
        string InstructionsZh,
        bool RequiresHandover,
        string HandoverEn,
        string HandoverZh,
        EventProgrammeItemStatus Status);
}
