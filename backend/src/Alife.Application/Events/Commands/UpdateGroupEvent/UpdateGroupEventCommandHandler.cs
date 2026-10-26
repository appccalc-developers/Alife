using System.Text.Json;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Composition;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Commands.UpdateGroupEvent;

public sealed class UpdateGroupEventCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IEventCacheInvalidationService eventCacheInvalidationService,
    IEventPackageInvalidationService packageInvalidationService,
    IEventCompositionEngine? compositionEngine = null,
    IEventActivityTemplateCatalog? activityTemplateCatalog = null)
    : IRequestHandler<UpdateGroupEventCommand, AppResult<GroupEventSummaryDto>>
{
    public async Task<AppResult<GroupEventSummaryDto>> Handle(UpdateGroupEventCommand request, CancellationToken cancellationToken)
    {
        if (EventCompositionRequestContract.HasUnsupportedSchema(request.Composition))
            return AppResult<GroupEventSummaryDto>.Validation(
                $"schemaVersion must be {EventCompositionDefinitions.SchemaVersion}.",
                EventCompositionDefinitions.UnsupportedSchemaErrorCode);
        if (EventCompositionRequestContract.ValidateComplete(request.Composition!) is { } compositionError)
            return AppResult<GroupEventSummaryDto>.Validation(
                compositionError,
                EventCompositionRequestContract.InvalidCompositionErrorCode);
        if (string.IsNullOrWhiteSpace(request.CompositionProposalHash) ||
            string.IsNullOrWhiteSpace(request.PlanETag) ||
            !request.Composition!.BasePlanVersion.HasValue)
            return AppResult<GroupEventSummaryDto>.Validation(
                "compositionProposalHash, planETag and composition.basePlanVersion are required for an Event detail update.",
                EventCompositionRequestContract.InvalidCompositionErrorCode);
        var compositionRequest = request.Composition!;

        await using var transaction = await dbContext.BeginSerializableTransactionAsync(cancellationToken);
        await dbContext.LockEventRegistrationAsync(request.EventId, cancellationToken);
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

        if (string.IsNullOrWhiteSpace(request.IfMatch) ||
            !DateTime.TryParse(request.IfMatch.Trim('"'), null,
                System.Globalization.DateTimeStyles.RoundtripKind, out var expectedUpdate) ||
            expectedUpdate != groupEvent.UpdatedUtc)
            return AppResult<GroupEventSummaryDto>.PreconditionFailed("Event details changed. Refresh and review before saving. / 活动资料已更新，请刷新核对后再保存。");

        if (await EventPreparationPolicy.IsFrozenAsync(dbContext, groupEvent.Id, cancellationToken))
            return AppResult<GroupEventSummaryDto>.Conflict(EventPreparationPolicy.FrozenMessage);

        if (EventDataContract.Validate(request.EventDataJson, request.TitleEn, request.TitleZh,
                request.StartDate, request.EndDate) is { } eventDataError)
            return AppResult<GroupEventSummaryDto>.Validation(eventDataError);
        if (!EventVisibilityPolicy.TryReadVisibility(request.EventDataJson, out var visibility))
        {
            return AppResult<GroupEventSummaryDto>.Validation("Event data must be a JSON object with a supported visibility.");
        }

        if (await dbContext.EventRegistrationPolicies.AnyAsync(x => x.EventId == groupEvent.Id, cancellationToken))
        {
            using var currentData = System.Text.Json.JsonDocument.Parse(groupEvent.EventDataJson);
            using var incomingData = System.Text.Json.JsonDocument.Parse(request.EventDataJson);
            foreach (var field in new[] { "registrationRulesVersion", "registrationDeadline", "maxCapacity" })
            {
                if (!currentData.RootElement.TryGetProperty(field, out var original) ||
                    !incomingData.RootElement.TryGetProperty(field, out var incoming) || !JsonEquivalent(original.GetRawText(), incoming.GetRawText()))
                    return AppResult<GroupEventSummaryDto>.Conflict("Registration rules have been upgraded. Preserve their current version and use the registration rules page to change capacity or deadlines. / 报名已升级，请使用报名规则页面修改人数或截止时间，并刷新活动资料后再保存。");
            }
        }

        var contactProfileIds = (request.ContactProfileIds ?? []).Distinct().ToArray();
        var validContactCount = await dbContext.ContactProfiles.AsNoTracking().CountAsync(
            x => x.OwnerGroupId == groupEvent.GroupId && contactProfileIds.Contains(x.Id), cancellationToken);
        if (validContactCount != contactProfileIds.Length)
        {
            return AppResult<GroupEventSummaryDto>.Validation("Every event contact must belong to the event group.");
        }

        var activeSnapshot = await dbContext.EventPlanSnapshots
            .Where(x => x.EventId == groupEvent.Id && x.IsActive)
            .OrderByDescending(x => x.Version)
            .FirstOrDefaultAsync(cancellationToken);
        var currentPlanETag = activeSnapshot?.ETag ?? EventCompositionPersistence.CreateEmptyPlanETag(groupEvent);
        if (string.IsNullOrWhiteSpace(request.PlanETag) ||
            !string.Equals(request.PlanETag.Trim(), currentPlanETag, StringComparison.Ordinal) ||
            compositionRequest.BasePlanVersion != groupEvent.ActivePlanVersion)
            return AppResult<GroupEventSummaryDto>.PreconditionFailed(
                "The event plan changed. Refresh and review before saving Event details.");

        EventPlanSnapshotDto? basePlan = null;
        if (activeSnapshot is not null)
        {
            try { basePlan = EventCompositionPersistence.ToSnapshotDto(activeSnapshot); }
            catch (JsonException) { return AppResult<GroupEventSummaryDto>.Conflict("The active event plan snapshot is invalid."); }
        }
        if (EventPreparationPolicy.ChangesTemplate(basePlan, compositionRequest))
            return AppResult<GroupEventSummaryDto>.Conflict(EventPreparationPolicy.TemplateLockedMessage);

        var activityPlan = compositionRequest.ActivityPlan;
        if (activityPlan is null)
            return AppResult<GroupEventSummaryDto>.Validation(
                "activityPlan is required in schemaVersion 2.0.0.",
                EventCompositionRequestContract.InvalidCompositionErrorCode);
        if (EventActivityPlanService.Validate(activityPlan) is { } activityError)
            return AppResult<GroupEventSummaryDto>.Validation(
                activityError,
                EventCompositionRequestContract.InvalidCompositionErrorCode);
        var occurrenceIds = activityPlan.Activities.Where(x => x.OccurrenceId.HasValue)
            .Select(x => x.OccurrenceId!.Value).Distinct().ToArray();
        if (await dbContext.EventOccurrences.CountAsync(x => x.EventId == groupEvent.Id && occurrenceIds.Contains(x.Id), cancellationToken) != occurrenceIds.Length)
            return AppResult<GroupEventSummaryDto>.Validation("The occurrence must belong to this Event.");

        var activityRow = await dbContext.EventActivityPlans.FirstOrDefaultAsync(x => x.EventId == groupEvent.Id, cancellationToken);
        ActivityPlanData? previousActivityPlan = null;
        if (activityRow is not null)
        {
            try { previousActivityPlan = EventActivityPlanService.Parse(activityRow.DataJson); }
            catch (JsonException) { return AppResult<GroupEventSummaryDto>.Conflict("The saved activity plan is invalid."); }
        }
        var changedProjectIds = (previousActivityPlan?.Activities ?? []).Where(old =>
            !activityPlan.Activities.Any(current => current.Id == old.Id &&
                current.OccurrenceId == old.OccurrenceId &&
                current.RepeatForEachOccurrence == old.RepeatForEachOccurrence)).Select(x => x.Id).ToArray();
        if (changedProjectIds.Length > 0 && await dbContext.EventActivityParticipations.AsNoTracking().AnyAsync(x =>
                x.Offer.EventId == groupEvent.Id && changedProjectIds.Contains(x.Offer.ActivityId), cancellationToken))
            return AppResult<GroupEventSummaryDto>.Conflict(
                "A project with participation history must remain for audit. Cancel and settle its registrations before replacing it.");
        if (await EventActivityPlanConsistency.ConflictAsync(dbContext, groupEvent.Id, activityPlan, cancellationToken) is { } activityConflict)
            return AppResult<GroupEventSummaryDto>.Conflict(activityConflict);

        var protectedModules = await EventCompositionPersistence.GetProtectedModuleCodesAsync(
            dbContext, groupEvent, cancellationToken);
        var candidateEvent = new GroupEvent { EventDataJson = request.EventDataJson };
        var composition = EventPreparationPolicy.WithSavedDetails(candidateEvent, compositionRequest with
        {
            BasePlanVersion = groupEvent.ActivePlanVersion,
            ActivityPlan = activityPlan
        });
        var activityTypesByCode = activityTemplateCatalog is null
            ? EventCompositionDefinitions.ActivityTypesByCode
            : await activityTemplateCatalog.ActiveDefinitionsByCodeAsync(cancellationToken);
        var proposalResult = (compositionEngine ?? new EventCompositionEngine()).Compose(composition,
            new EventCompositionContext(
                currentPlanETag,
                basePlan?.Plan.ModuleDecisions,
                protectedModules,
                EventCompositionPersistence.GetSatisfiedReadinessRules(groupEvent),
                groupEvent.AccountableOwnerMemberId != Guid.Empty,
                groupEvent.GovernanceMode,
                groupEvent.SponsorshipStatus,
                ActivityTypesByCode: activityTypesByCode,
                IsPreparationDraft: groupEvent.PublicationStatus == EventPublicationStatus.Draft));
        if (!proposalResult.IsSuccess) return CopyFailure<EventPlanProposalDto, GroupEventSummaryDto>(proposalResult);
        var proposal = proposalResult.Value!;
        if (string.IsNullOrWhiteSpace(request.CompositionProposalHash) ||
            !string.Equals(proposal.ProposalHash, request.CompositionProposalHash.Trim(), StringComparison.Ordinal))
            return AppResult<GroupEventSummaryDto>.PreconditionFailed(
                "The Event details proposal is stale or changed after review.");
        if (proposal.Diff.BlockingRetirements.Count > 0)
            return AppResult<GroupEventSummaryDto>.Conflict(
                $"Modules with operational data require explicit retirement: {string.Join(", ", proposal.Diff.BlockingRetirements)}.");

        if (request.SeriesUpdate is { } seriesUpdate)
        {
            if (groupEvent.EventSeriesId is not { } seriesId || seriesUpdate.Details is null)
                return AppResult<GroupEventSummaryDto>.Validation("This event has no editable recurring schedule. / 此活动没有可编辑的重复安排。");
            var updated = await new UpdateEventSeriesCommandHandler(dbContext, groupAuthorizationService).Handle(
                new(seriesId, request.CurrentMemberId, seriesUpdate.Details, seriesUpdate.ETag,
                    TransactionAlreadyStarted: true, PreparationEventId: groupEvent.Id), cancellationToken);
            if (!updated.IsSuccess) return CopyFailure<EventSeriesDto, GroupEventSummaryDto>(updated);
        }

        var existingContacts = await dbContext.EventContactProfiles
            .Where(x => x.EventId == groupEvent.Id)
            .ToListAsync(cancellationToken);
        var materialChange = groupEvent.StartDate != request.StartDate ||
            groupEvent.EndDate != request.EndDate ||
            !GovernanceEventDataEquivalent(groupEvent.EventDataJson, request.EventDataJson) ||
            !existingContacts.Select(x => x.ContactProfileId).Order().SequenceEqual(contactProfileIds.Order());
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
        var activityJson = RamEvaluator.Serialize(activityPlan);
        var activityChanged = activityRow is null || !string.Equals(activityRow.DataJson, activityJson, StringComparison.Ordinal);
        if (activityRow is null)
        {
            activityRow = new EventActivityPlan { EventId = groupEvent.Id };
            dbContext.EventActivityPlans.Add(activityRow);
        }
        if (activityChanged)
        {
            var beforeJson = activityRow.DataJson;
            activityRow.DataJson = activityJson;
            activityRow.ConcurrencyToken = Guid.NewGuid();
            activityRow.UpdatedUtc = now;
            dbContext.AuditLogs.Add(new AuditLog
            {
                Id = Guid.NewGuid(), ActorMemberId = request.CurrentMemberId,
                Action = "event.activityPlan.saveWithDetails", EntityType = "group_event", EntityId = groupEvent.Id,
                BeforeJson = string.IsNullOrWhiteSpace(beforeJson) ? "{}" : beforeJson, AfterJson = activityJson,
                MetadataJson = JsonSerializer.Serialize(new { activityCount = activityPlan.Activities.Length }),
                OccurredUtc = now
            });
        }

        var factVersion = (await dbContext.EventFactSets.Where(x => x.EventId == groupEvent.Id)
            .MaxAsync(x => (int?)x.Version, cancellationToken) ?? 0) + 1;
        var planVersion = (await dbContext.EventPlanSnapshots.Where(x => x.EventId == groupEvent.Id)
            .MaxAsync(x => (int?)x.Version, cancellationToken) ?? 0) + 1;
        var factSet = new EventFactSet
        {
            Id = Guid.NewGuid(), EventId = groupEvent.Id, Version = factVersion,
            SchemaVersion = proposal.SchemaVersion,
            FactsJson = JsonSerializer.Serialize(proposal.Facts.Items, EventCompositionEngine.CreateJsonOptions()),
            SourceHash = proposal.Facts.SourceHash, CreatedByMemberId = request.CurrentMemberId, CreatedUtc = now
        };
        var acceptedProposal = proposal with { Facts = proposal.Facts with { Version = factVersion } };
        var planETag = EventCompositionPersistence.CreatePlanETag(planVersion, proposal.ProposalHash);
        var snapshot = new EventPlanSnapshot
        {
            Id = Guid.NewGuid(), EventId = groupEvent.Id, SourceFactSetId = factSet.Id,
            Version = planVersion, SchemaVersion = proposal.SchemaVersion, ProposalHash = proposal.ProposalHash,
            ETag = planETag, ArchetypeCode = proposal.ArchetypeCode, ArchetypeVersion = proposal.ArchetypeVersion,
            ActivityTypeCode = proposal.ActivityTypeCode, ActivityTypeVersion = proposal.ActivityTypeVersion,
            SnapshotJson = EventCompositionPersistence.SerializePlan(acceptedProposal, []),
            AcceptedByMemberId = request.CurrentMemberId, AcceptedUtc = now, IsActive = true, CreatedUtc = now
        };
        if (activeSnapshot is not null) activeSnapshot.IsActive = false;
        dbContext.EventFactSets.Add(factSet);
        dbContext.EventPlanSnapshots.Add(snapshot);
        groupEvent.ActivePlanVersion = planVersion;
        groupEvent.PlanConcurrencyToken = Guid.NewGuid();

        if (groupEvent.RamAssessment is not null && (materialChange || activityChanged))
        {
            if (activityChanged)
            {
                var context = await EventPlanContextCapture.CaptureAsync(dbContext, groupEvent, cancellationToken);
                context = context with { ActivityPlan = new(activityPlan, activityRow.ConcurrencyToken.ToString()) };
                groupEvent.RamAssessment.RamDataJson = RamEvaluator.Serialize(
                    EventActivityPlanService.Mirror(RamEvaluator.Parse(groupEvent.RamAssessment.RamDataJson), context));
            }
            EventRamGovernanceService.Invalidate(groupEvent.RamAssessment);
            groupEvent.RamAssessment.UpdatedUtc = now;
        }
        await packageInvalidationService.InvalidateForMaterialChangeAsync(
            groupEvent,
            request.CurrentMemberId,
            materialChange || activityChanged ? "event.details.planAccepted" : "event.plan.accepted",
            materialChange || activityChanged ? "governanceCritical" : "operational",
            cancellationToken);
        try
        {
            if (!await EventPreparationPolicy.SaveEditableAsync(dbContext, request.EventId, cancellationToken, transactionAlreadyStarted: true))
                return AppResult<GroupEventSummaryDto>.Conflict(EventPreparationPolicy.FrozenMessage);
            if (transaction is not null) await transaction.CommitAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return AppResult<GroupEventSummaryDto>.PreconditionFailed(
                "The Event details or plan changed while they were being saved.");
        }
        await eventCacheInvalidationService.RemoveGroupEventsAsync(groupEvent.GroupId, cancellationToken);
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

    private static AppResult<TTarget> CopyFailure<TSource, TTarget>(AppResult<TSource> source)
        => source.Status switch
        {
            AppResultStatus.NotFound => AppResult<TTarget>.NotFound(source.Message ?? "Not found."),
            AppResultStatus.Forbidden => AppResult<TTarget>.Forbidden(source.Message ?? "Forbidden."),
            AppResultStatus.Conflict => AppResult<TTarget>.Conflict(source.Message ?? "Conflict."),
            AppResultStatus.PreconditionFailed => AppResult<TTarget>.PreconditionFailed(source.Message ?? "Precondition failed."),
            _ => AppResult<TTarget>.Validation(source.Message ?? "Validation failed.", source.Code)
        };

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
