using Alife.Api.Http;
using Alife.Api.Results;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Common.Interfaces;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Alife.Api.Controllers;

[ApiController, Authorize, Route("api/events/{eventId:guid}/preparation/arrangements")]
public sealed class EventPreparationArrangementsController(IAlifeDbContext db, IGroupAuthorizationService authorization,
    ICurrentMemberAccessor members) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(Guid eventId, [FromQuery] Guid? occurrenceId, CancellationToken ct)
    {
        this.ApplyPrivateNoStoreHeaders();
        var member = members.GetCurrentMemberId();
        if (!member.HasValue) return Unauthorized();
        var item = await db.GroupEvents.AsNoTracking().FirstOrDefaultAsync(x => x.Id == eventId, ct);
        if (item is null) return NotFound();
        if (!await EventCompositionPersistence.CanManageEventAsync(db, authorization, item, member.Value, ct)) return Forbid();
        return this.ToActionResult(await EventPreparationArrangements.ReadAsync(db, eventId, occurrenceId, ct));
    }
}
