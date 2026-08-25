using System.Text.Json;
using System.Text.Json.Nodes;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Commands.UpdateGroupEvent;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Commands.UpdateEventRegistrationSettings;

public sealed class UpdateEventRegistrationSettingsCommandHandler(IAlifeDbContext db, ISender sender)
    : IRequestHandler<UpdateEventRegistrationSettingsCommand, AppResult<GroupEventSummaryDto>>
{
    public async Task<AppResult<GroupEventSummaryDto>> Handle(
        UpdateEventRegistrationSettingsCommand request,
        CancellationToken cancellationToken)
    {
        if (request.MaxCapacity < 0)
            return AppResult<GroupEventSummaryDto>.Validation("Capacity cannot be negative.");
        if (request.CapacityUnit is not EventRegistrationPolicy.People and not EventRegistrationPolicy.Families)
            return AppResult<GroupEventSummaryDto>.Validation("Capacity unit must be People or Families.");

        var groupEvent = await db.GroupEvents.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == request.EventId, cancellationToken);
        if (groupEvent is null) return AppResult<GroupEventSummaryDto>.NotFound("Event not found.");
        if (!EventRegistrationPolicy.IsEnabled(groupEvent))
            return AppResult<GroupEventSummaryDto>.Conflict("Add registration to this event plan before changing registration settings.");
        if (request.MaxCapacity > 0 && !request.RegistrationDeadlineUtc.HasValue)
            return AppResult<GroupEventSummaryDto>.Validation("A registration deadline is required when registration is enabled.");
        if (request.RegistrationDeadlineUtc.HasValue && request.RegistrationDeadlineUtc.Value > groupEvent.StartDate)
            return AppResult<GroupEventSummaryDto>.Validation("The registration deadline must be before the event starts.");

        JsonObject eventData;
        try
        {
            eventData = JsonNode.Parse(groupEvent.EventDataJson) as JsonObject ?? new JsonObject();
        }
        catch (JsonException)
        {
            return AppResult<GroupEventSummaryDto>.Validation("Event data is invalid and cannot be updated safely.");
        }

        eventData["maxCapacity"] = request.MaxCapacity;
        eventData["capacityUnit"] = request.CapacityUnit;
        if (request.MaxCapacity == 0)
            eventData.Remove("registrationDeadline");
        else
            eventData["registrationDeadline"] = request.RegistrationDeadlineUtc!.Value.ToUniversalTime().ToString("O");

        var contactIds = await db.EventContactProfiles.AsNoTracking()
            .Where(x => x.EventId == request.EventId)
            .Select(x => x.ContactProfileId)
            .ToArrayAsync(cancellationToken);
        return await sender.Send(new UpdateGroupEventCommand(
            groupEvent.Id,
            request.CurrentMemberId,
            groupEvent.TitleEn,
            groupEvent.TitleZh,
            groupEvent.StartDate,
            groupEvent.EndDate,
            eventData.ToJsonString(),
            contactIds,
            null), cancellationToken);
    }
}
