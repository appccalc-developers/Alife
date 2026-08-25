using System.Text.Json;
using System.Text.Json.Nodes;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Commands.UpdateGroupEvent;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Commands.UpdateEventFinanceSettings;

public sealed class UpdateEventFinanceSettingsCommandHandler(IAlifeDbContext db, ISender sender)
    : IRequestHandler<UpdateEventFinanceSettingsCommand, AppResult<GroupEventSummaryDto>>
{
    public async Task<AppResult<GroupEventSummaryDto>> Handle(UpdateEventFinanceSettingsCommand request, CancellationToken cancellationToken)
    {
        var validationError = Validate(request);
        if (validationError is not null) return AppResult<GroupEventSummaryDto>.Validation(validationError);
        var groupEvent = await db.GroupEvents.AsNoTracking().FirstOrDefaultAsync(x => x.Id == request.EventId, cancellationToken);
        if (groupEvent is null) return AppResult<GroupEventSummaryDto>.NotFound("Event not found.");
        if (!EventFinancePolicy.IsEnabled(groupEvent))
            return AppResult<GroupEventSummaryDto>.Conflict("Add finance to this event plan before changing finance settings.");

        JsonObject eventData;
        try { eventData = JsonNode.Parse(groupEvent.EventDataJson) as JsonObject ?? new JsonObject(); }
        catch (JsonException) { return AppResult<GroupEventSummaryDto>.Validation("Event data is invalid and cannot be updated safely."); }

        eventData["baseFeePerAdult"] = request.Enabled ? request.AdultFee : null;
        eventData["baseFeePerChild"] = request.Enabled ? request.ChildFee : null;
        eventData["currency"] = request.Currency.Trim().ToUpperInvariant();
        eventData["paymentInstructions"] = Text(request.Enabled ? request.PaymentInstructionsEn : "", request.Enabled ? request.PaymentInstructionsZh : "");
        eventData["refundPolicy"] = Text(request.Enabled ? request.RefundPolicyEn : "", request.Enabled ? request.RefundPolicyZh : "");
        eventData["paymentEvidenceRequired"] = request.Enabled && request.PaymentEvidenceRequired;
        eventData["financeLeaderConfirmed"] = request.LeaderConfirmed;
        eventData["optionalActivities"] = new JsonArray(request.Options
            .Select(x => (JsonNode)new JsonObject
            {
                ["id"] = string.IsNullOrWhiteSpace(x.Id) ? Guid.NewGuid().ToString() : x.Id.Trim(),
                ["name"] = Text(x.NameEn, x.NameZh),
                ["extraFee"] = request.Enabled ? x.ExtraFee : 0
            }).ToArray());

        if (request.LeaderConfirmed)
        {
            var projection = new Alife.Domain.Entities.GroupEvent
            {
                EventDataJson = eventData.ToJsonString()
            };
            EventFinancePolicy.TryReadSettings(projection, out var settings, out _);
            if (!EventFinancePolicy.IsComplete(settings))
                return AppResult<GroupEventSummaryDto>.Validation("Complete the bilingual payment and refund information before confirming participant charges.");
        }

        var contactIds = await db.EventContactProfiles.AsNoTracking()
            .Where(x => x.EventId == request.EventId)
            .Select(x => x.ContactProfileId)
            .ToArrayAsync(cancellationToken);
        return await sender.Send(new UpdateGroupEventCommand(
            groupEvent.Id, request.CurrentMemberId, groupEvent.TitleEn, groupEvent.TitleZh,
            groupEvent.StartDate, groupEvent.EndDate, eventData.ToJsonString(), contactIds, null, true), cancellationToken);
    }

    private static string? Validate(UpdateEventFinanceSettingsCommand request)
    {
        if (request.Currency.Trim().Length != 3) return "Currency must be a three-letter code.";
        if (request.AdultFee < 0 || request.ChildFee < 0 || request.Options.Any(x => x.ExtraFee < 0))
            return "Fees cannot be negative.";
        if (request.Options.Count > 50) return "An event cannot have more than 50 fee options.";
        if (request.Options.Any(x => x.NameEn.Length > 200 || x.NameZh.Length > 200))
            return "Optional activity names cannot exceed 200 characters.";
        if (new[] { request.PaymentInstructionsEn, request.PaymentInstructionsZh, request.RefundPolicyEn, request.RefundPolicyZh }.Any(x => x.Length > 2000))
            return "Payment and refund text cannot exceed 2000 characters per language.";
        return null;
    }

    private static JsonObject Text(string en, string zh) => new() { ["en"] = en.Trim(), ["zh"] = zh.Trim() };
}
