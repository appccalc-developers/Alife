using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Composition;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Commands.UpdateGroupEvent;

public sealed class UpdateGroupEventCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IEventCacheInvalidationService eventCacheInvalidationService,
    IEventPackageInvalidationService packageInvalidationService)
    : IRequestHandler<UpdateGroupEventCommand, AppResult<GroupEventSummaryDto>>
{
    public async Task<AppResult<GroupEventSummaryDto>> Handle(UpdateGroupEventCommand request, CancellationToken cancellationToken)
    {
        await using var transaction = await dbContext.BeginSerializableTransactionAsync(cancellationToken);
        var groupEvent = await dbContext.GroupEvents
            .Include(e => e.RamAssessment)
            .FirstOrDefaultAsync(e => e.Id == request.EventId, cancellationToken);

        if (groupEvent is null)
        {
            return AppResult<GroupEventSummaryDto>.NotFound("Event not found.");
        }

        var canManage = await EventCompositionPersistence.CanManageEventAsync(dbContext,
            groupAuthorizationService, groupEvent, request.CurrentMemberId, cancellationToken);

        if (!canManage)
        {
            return AppResult<GroupEventSummaryDto>.Forbidden("Only the accountable owner can update events.");
        }

        if (request.RamDataJson is not null && groupEvent.RamAssessment?.SchemaVersion >= 2)
            return AppResult<GroupEventSummaryDto>.Conflict(EventRamGovernanceService.UpgradeMessage);

        if (request.IfMatch is not null && (!DateTime.TryParse(request.IfMatch.Trim('"'), null,
            System.Globalization.DateTimeStyles.RoundtripKind, out var expectedUpdate) || expectedUpdate != groupEvent.UpdatedUtc))
            return AppResult<GroupEventSummaryDto>.PreconditionFailed("Event details changed. Refresh and review before saving. / 活动资料已更新，请刷新核对后再保存。");

        if (await EventPreparationPolicy.IsFrozenAsync(dbContext, groupEvent.Id, cancellationToken))
            return AppResult<GroupEventSummaryDto>.Conflict(EventPreparationPolicy.FrozenMessage);
        if (request.SeriesUpdate is { } seriesUpdate)
        {
            if (groupEvent.EventSeriesId is not { } seriesId || seriesUpdate.Details is null)
                return AppResult<GroupEventSummaryDto>.Validation("This event has no editable recurring schedule. / 此活动没有可编辑的重复安排。");
            var updated = await new UpdateEventSeriesCommandHandler(dbContext, groupAuthorizationService).Handle(
                new(seriesId, request.CurrentMemberId, seriesUpdate.Details, seriesUpdate.ETag,
                    TransactionAlreadyStarted: true, PreparationEventId: groupEvent.Id), cancellationToken);
            if (!updated.IsSuccess) return updated.Status switch {
                AppResultStatus.PreconditionFailed => AppResult<GroupEventSummaryDto>.PreconditionFailed(updated.Message!),
                AppResultStatus.Forbidden => AppResult<GroupEventSummaryDto>.Forbidden(updated.Message!),
                AppResultStatus.Conflict => AppResult<GroupEventSummaryDto>.Conflict(updated.Message!),
                _ => AppResult<GroupEventSummaryDto>.Validation(updated.Message!)
            };
        }

        if (!EventVisibilityPolicy.TryReadVisibility(request.EventDataJson, out var visibility))
        {
            return AppResult<GroupEventSummaryDto>.Validation("Event data must be a JSON object with a supported visibility.");
        }

        var contactProfileIds = (request.ContactProfileIds ?? []).Distinct().ToArray();
        var validContactCount = await dbContext.ContactProfiles.AsNoTracking().CountAsync(
            x => x.OwnerGroupId == groupEvent.GroupId && contactProfileIds.Contains(x.Id), cancellationToken);
        if (validContactCount != contactProfileIds.Length)
        {
            return AppResult<GroupEventSummaryDto>.Validation("Every event contact must belong to the event group.");
        }

        var existingContacts = await dbContext.EventContactProfiles
            .Where(x => x.EventId == groupEvent.Id)
            .ToListAsync(cancellationToken);
        var materialChange = groupEvent.StartDate != request.StartDate ||
            groupEvent.EndDate != request.EndDate ||
            !GovernanceEventDataEquivalent(groupEvent.EventDataJson, request.EventDataJson) ||
            !existingContacts.Select(x => x.ContactProfileId).Order().SequenceEqual(contactProfileIds.Order()) ||
            (request.RamDataJson is not null &&
                !JsonEquivalent(groupEvent.RamAssessment?.RamDataJson ?? "{}", request.RamDataJson));
        dbContext.EventContactProfiles.RemoveRange(existingContacts);
        dbContext.EventContactProfiles.AddRange(contactProfileIds.Select(contactProfileId => new Alife.Domain.Entities.EventContactProfile
        {
            EventId = groupEvent.Id,
            ContactProfileId = contactProfileId
        }));

        groupEvent.TitleEn = request.TitleEn;
        groupEvent.TitleZh = request.TitleZh;
        groupEvent.StartDate = request.StartDate;
        groupEvent.EndDate = request.EndDate;
        groupEvent.EventDataJson = request.EventDataJson;
        var now = DateTime.UtcNow;
        groupEvent.UpdatedUtc = now;
        // A submitted snapshot must be regenerated after any preparation edit,
        // including copy changes. The separate post-approval poster operation
        // deliberately preserves this source-evidence token.
        groupEvent.PlanConcurrencyToken = Guid.NewGuid();

        if (request.RamDataJson is not null)
        {
            if (groupEvent.RamAssessment is not null)
                await EventRamGovernanceService.ArchiveLegacyAsync(dbContext, groupEvent.RamAssessment, request.CurrentMemberId, cancellationToken);
            if (!EventRamPolicy.IsValidJson(request.RamDataJson))
            {
                return AppResult<GroupEventSummaryDto>.Validation("RAM data must be a JSON object.");
            }

            if (groupEvent.RamAssessment is null)
            {
                groupEvent.RamAssessment = new Alife.Domain.Entities.EventRamAssessment
                {
                    EventId = groupEvent.Id,
                    CreatedUtc = now
                };
                dbContext.EventRamAssessments.Add(groupEvent.RamAssessment);
            }

            groupEvent.RamAssessment.RamDataJson = request.RamDataJson;
        }

        if (groupEvent.RamAssessment is not null && materialChange)
        {
            await EventRamGovernanceService.ArchiveLegacyAsync(dbContext, groupEvent.RamAssessment, request.CurrentMemberId, cancellationToken);
            EventRamGovernanceService.Invalidate(groupEvent.RamAssessment);
            groupEvent.RamAssessment.Status = Alife.Domain.Enums.EventRamStatus.Draft;
            groupEvent.RamAssessment.SubmittedByMemberId = null;
            groupEvent.RamAssessment.SubmittedUtc = null;
            groupEvent.RamAssessment.ApprovedByMemberId = null;
            groupEvent.RamAssessment.ApprovedUtc = null;
            groupEvent.RamAssessment.UpdatedUtc = now;
        }
        if (materialChange)
        {
            await packageInvalidationService.InvalidateForMaterialChangeAsync(
                groupEvent,
                request.CurrentMemberId,
                "event.core.materialChange",
                "governanceCritical",
                cancellationToken);
        }
        if (!await EventPreparationPolicy.SaveEditableAsync(dbContext, request.EventId, cancellationToken, transactionAlreadyStarted: true)) return AppResult<GroupEventSummaryDto>.Conflict(EventPreparationPolicy.FrozenMessage);
        if (transaction is not null) await transaction.CommitAsync(cancellationToken);
        await eventCacheInvalidationService.RemoveGroupEventsAsync(groupEvent.GroupId, cancellationToken);
        await eventCacheInvalidationService.RemoveEventEnrollmentsAsync(groupEvent.Id, cancellationToken);
        await eventCacheInvalidationService.RemoveEventReviewsAsync(groupEvent.Id, cancellationToken);

        return AppResult<GroupEventSummaryDto>.Success(new GroupEventSummaryDto(
            groupEvent.Id,
            groupEvent.GroupId,
            groupEvent.CreatedByMemberId,
            groupEvent.TitleEn,
            groupEvent.TitleZh,
            groupEvent.StartDate,
            groupEvent.EndDate,
            groupEvent.EventDataJson,
            groupEvent.CreatedUtc,
            groupEvent.UpdatedUtc,
            contactProfileIds,
            groupEvent.RamAssessment?.Status ?? Alife.Domain.Enums.EventRamStatus.Draft,
            visibility,
            groupEvent.AccountableOwnerMemberId,
            groupEvent.GovernanceMode,
            groupEvent.SponsorshipStatus,
            groupEvent.ActivePlanVersion));
    }

    private static bool JsonEquivalent(string left, string right)
    {
        try
        {
            using var leftDocument = System.Text.Json.JsonDocument.Parse(left);
            using var rightDocument = System.Text.Json.JsonDocument.Parse(right);
            return string.Equals(
                EventPackageCanonicalizer.Serialize(leftDocument.RootElement),
                EventPackageCanonicalizer.Serialize(rightDocument.RootElement),
                StringComparison.Ordinal);
        }
        catch (System.Text.Json.JsonException)
        {
            return string.Equals(left, right, StringComparison.Ordinal);
        }
    }

    private static bool GovernanceEventDataEquivalent(string left, string right)
    {
        try
        {
            return JsonEquivalent(
                EventPackageCanonicalizer.GovernanceEventDataProjection(left),
                EventPackageCanonicalizer.GovernanceEventDataProjection(right));
        }
        catch (System.Text.Json.JsonException)
        {
            return false;
        }
    }

}
