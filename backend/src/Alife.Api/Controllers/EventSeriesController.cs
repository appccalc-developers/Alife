using Alife.Api.Http;
using Alife.Api.Results;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Events.Commands.GenerateEventSeriesInstances;
using Alife.Application.Events.Commands.SaveEventSeries;
using Alife.Application.Events.Queries.ListEventSeries;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Controllers;

[ApiController]
[Route("api")]
[Authorize]
public sealed class EventSeriesController(IMediator mediator, ICurrentMemberAccessor currentMemberAccessor) : ControllerBase
{
    [HttpGet("groups/{groupId:guid}/event-series")]
    public async Task<IActionResult> List(Guid groupId, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null) return Unauthorized();
        var result = await mediator.Send(new ListEventSeriesQuery(groupId, currentMemberId.Value), cancellationToken);
        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpPost("groups/{groupId:guid}/event-series")]
    public Task<IActionResult> Create(Guid groupId, [FromBody] SaveEventSeriesRequest request, CancellationToken cancellationToken)
        => Save(null, groupId, request, cancellationToken);

    [HttpPut("groups/{groupId:guid}/event-series/{seriesId:guid}")]
    public Task<IActionResult> Update(Guid groupId, Guid seriesId, [FromBody] SaveEventSeriesRequest request, CancellationToken cancellationToken)
        => Save(seriesId, groupId, request, cancellationToken);

    [HttpPost("event-series/{seriesId:guid}/generate")]
    public async Task<IActionResult> Generate(Guid seriesId, [FromBody] GenerateEventSeriesRequest request, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null) return Unauthorized();
        return this.ToActionResult(await mediator.Send(new GenerateEventSeriesInstancesCommand(
            seriesId, currentMemberId.Value, request.FromLocalDate, request.HorizonWeeks), cancellationToken));
    }

    private async Task<IActionResult> Save(Guid? seriesId, Guid groupId, SaveEventSeriesRequest request, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null) return Unauthorized();
        return this.ToActionResult(await mediator.Send(new SaveEventSeriesCommand(
            seriesId, groupId, currentMemberId.Value,
            request.NameEn, request.NameZh, request.DescriptionEn, request.DescriptionZh,
            request.TimeZoneId, request.AnchorLocalDate, request.StartTimeMinutes, request.DurationMinutes,
            request.IntervalWeeks, request.GenerationHorizonWeeks, request.LowHorizonWeeks,
            request.Visibility, request.DefaultModules ?? [], request.IsActive), cancellationToken));
    }

    public sealed record SaveEventSeriesRequest(
        string NameEn,
        string NameZh,
        string DescriptionEn,
        string DescriptionZh,
        string TimeZoneId,
        DateOnly AnchorLocalDate,
        int StartTimeMinutes,
        int DurationMinutes,
        int IntervalWeeks,
        int GenerationHorizonWeeks,
        int LowHorizonWeeks,
        string Visibility,
        IReadOnlyList<string>? DefaultModules,
        bool IsActive);

    public sealed record GenerateEventSeriesRequest(DateOnly? FromLocalDate, int? HorizonWeeks);
}
