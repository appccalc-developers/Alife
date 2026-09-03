using Alife.Application.Common.Interfaces;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Services;

public sealed class EventPackageInvalidationService(
    IAlifeDbContext db,
    IEventCacheInvalidationService? cacheInvalidation = null) : IEventPackageInvalidationService
{
    public Task<EventPackageInvalidationResult> InvalidateForMaterialChangeAsync(
        GroupEvent groupEvent,
        Guid actorMemberId,
        string changeCode,
        string classification,
        CancellationToken cancellationToken = default)
        => InvalidateAsync(groupEvent, actorMemberId, null, null, changeCode, classification, cancellationToken);

    public Task<EventPackageInvalidationResult> InvalidateForModuleChangeAsync(
        GroupEvent groupEvent,
        Guid actorMemberId,
        string moduleCode,
        string changeCode,
        string classification,
        CancellationToken cancellationToken = default)
        => InvalidateAsync(groupEvent, actorMemberId, moduleCode, null, changeCode, classification, cancellationToken);

    public Task<EventPackageInvalidationResult> InvalidateForOccurrenceModuleChangeAsync(
        GroupEvent groupEvent,
        Guid occurrenceId,
        Guid actorMemberId,
        string moduleCode,
        string changeCode,
        string classification,
        CancellationToken cancellationToken = default)
        => InvalidateAsync(groupEvent, actorMemberId, moduleCode, occurrenceId, changeCode, classification, cancellationToken);

    private async Task<EventPackageInvalidationResult> InvalidateAsync(
        GroupEvent groupEvent,
        Guid actorMemberId,
        string? affectedModuleCode,
        Guid? affectedOccurrenceId,
        string changeCode,
        string classification,
        CancellationToken cancellationToken)
    {
        if (string.Equals(classification, "cosmetic", StringComparison.Ordinal))
            return new(0, false, false, false);

        var now = DateTime.UtcNow;
        var candidates = await db.EventPackages
            .Include(x => x.Decisions)
            .Include(x => x.SourceReferences)
            .Where(x => x.EventId == groupEvent.Id &&
                x.ApprovalValidityStatus == EventPackageApprovalValidity.Active)
            .ToListAsync(cancellationToken);
        var localBaselinePackages = new List<EventPackage>();
        List<EventPackage> packages;
        if (affectedOccurrenceId.HasValue && affectedModuleCode is not null)
        {
            var precise = candidates.Where(package => package.SourceReferences.Any(source =>
                source.ModuleCode == affectedModuleCode && source.SubjectType == "moduleOccurrence" &&
                source.SubjectId == affectedOccurrenceId.Value)).ToList();
            // Packages created before occurrence-granular source references fail safe at Event scope.
            var legacy = candidates.Where(package => IncludesModule(package.ManifestJson, affectedModuleCode) &&
                !package.SourceReferences.Any(source => source.ModuleCode == affectedModuleCode &&
                    source.SubjectType == "moduleOccurrence")).ToList();
            localBaselinePackages = precise.Where(package => package.ScopeType == EventPackageScopeType.Event &&
                CoveredOccurrenceCount(package.CoveredOccurrenceIdsJson) > 1).ToList();
            packages = precise.Where(package => package.ScopeType == EventPackageScopeType.Occurrence ||
                    CoveredOccurrenceCount(package.CoveredOccurrenceIdsJson) <= 1)
                .Concat(legacy).DistinctBy(package => package.Id).ToList();
        }
        else
        {
            packages = affectedModuleCode is null
                ? candidates
                : candidates.Where(x => IncludesModule(x.ManifestJson, affectedModuleCode)).ToList();
        }

        var localReviewRequired = false;
        var localReviewCreated = false;
        Guid? localReviewTaskId = null;
        EventOccurrence? affectedOccurrence = null;
        if (affectedOccurrenceId.HasValue && affectedModuleCode is not null && localBaselinePackages.Count > 0)
        {
            affectedOccurrence = await db.EventOccurrences.FirstOrDefaultAsync(x =>
                x.Id == affectedOccurrenceId.Value && x.EventId == groupEvent.Id, cancellationToken);
            if (affectedOccurrence is null)
                throw new InvalidOperationException("The affected occurrence does not belong to the Event.");
            localReviewTaskId = Guid.NewGuid();
            affectedOccurrence.ExceptionsJson = EventOccurrencePackageExceptionState.Raise(
                affectedOccurrence.ExceptionsJson, affectedModuleCode, changeCode, classification, actorMemberId, now,
                localBaselinePackages.Select(x => x.Id).ToArray(), localReviewTaskId.Value, out var created);
            localReviewCreated = created;
            affectedOccurrence.UpdatedUtc = now;
            localReviewRequired = created || EventOccurrencePackageExceptionState.HasOpen(
                affectedOccurrence.ExceptionsJson, affectedModuleCode);
            if (created)
            {
                db.AuditLogs.Add(new AuditLog
                {
                    Id = Guid.NewGuid(), ActorMemberId = actorMemberId,
                    Action = "event.package.occurrenceReviewRequired", EntityType = "EventOccurrence",
                    EntityId = affectedOccurrence.Id, GroupId = groupEvent.GroupId, EventId = groupEvent.Id,
                    BeforeJson = "{}",
                    AfterJson = EventPackageCanonicalizer.Serialize(new
                    {
                        occurrenceId = affectedOccurrence.Id, affectedModuleCode, changeCode, classification,
                        baselinePackageIds = localBaselinePackages.Select(x => x.Id).Order().ToArray()
                    }),
                    MetadataJson = EventPackageCanonicalizer.Serialize(new
                    {
                        scopeType = EventPackageScopeType.Occurrence,
                        nextAction = "event.package.generateOccurrenceReview",
                        unrelatedOccurrenceApprovalsPreserved = true
                    }),
                    OccurredUtc = now
                });
            }
        }

        if (packages.Count == 0 && !localReviewRequired)
            return new(0, false, false, false);
        if (packages.Count == 0 && localReviewRequired && !localReviewCreated)
            return new(0, false, false, false, true);

        var packageIds = packages.Select(x => x.Id).ToHashSet();
        foreach (var package in packages)
        {
            package.ApprovalValidityStatus = EventPackageApprovalValidity.Invalidated;
            package.ConcurrencyToken = Guid.NewGuid();
            foreach (var decision in package.Decisions.Where(x =>
                x.DecisionType is EventPackageDecisionType.Approve or EventPackageDecisionType.ApproveWithConditions &&
                x.InvalidatedReasonCode == null))
            {
                decision.InvalidatedReasonCode = changeCode;
            }

            db.AuditLogs.Add(new AuditLog
            {
                Id = Guid.NewGuid(),
                ActorMemberId = actorMemberId,
                Action = "event.package.invalidated",
                EntityType = "EventPackage",
                EntityId = package.Id,
                GroupId = groupEvent.GroupId,
                EventId = groupEvent.Id,
                BeforeJson = EventPackageCanonicalizer.Serialize(new
                {
                    approvalValidityStatus = EventPackageApprovalValidity.Active
                }),
                AfterJson = EventPackageCanonicalizer.Serialize(new
                {
                    approvalValidityStatus = EventPackageApprovalValidity.Invalidated,
                    changeCode,
                    classification
                }),
                MetadataJson = EventPackageCanonicalizer.Serialize(new
                {
                    package.ScopeType,
                    package.ScopeId,
                    package.Version,
                    package.ContentHash,
                    package.SourceVectorHash,
                    affectedModuleCode,
                    historyPreserved = true
                }),
                OccurredUtc = now
            });
        }

        var publicationWithdrawn = groupEvent.PublicationStatus == EventPublicationStatus.Published &&
            groupEvent.PublishedPackageId.HasValue && packageIds.Contains(groupEvent.PublishedPackageId.Value);
        var registrationPaused = groupEvent.RegistrationStatus == EventRegistrationStatus.Open &&
            groupEvent.RegistrationPackageId.HasValue && packageIds.Contains(groupEvent.RegistrationPackageId.Value);
        var executionBlocked = groupEvent.ExecutionStatus == EventExecutionStatus.Confirmed &&
            groupEvent.ExecutionPackageId.HasValue && packageIds.Contains(groupEvent.ExecutionPackageId.Value);
        var occurrenceExecutionBlocked = affectedOccurrence?.ExecutionStatus == EventExecutionStatus.Confirmed &&
            affectedOccurrence.ExecutionPackageId.HasValue &&
            (packageIds.Contains(affectedOccurrence.ExecutionPackageId.Value) ||
             localBaselinePackages.Any(x => x.Id == affectedOccurrence.ExecutionPackageId.Value));

        if (publicationWithdrawn)
        {
            groupEvent.PublicationStatus = EventPublicationStatus.Unpublished;
            groupEvent.PublicationConcurrencyToken = Guid.NewGuid();
        }
        if (registrationPaused)
        {
            groupEvent.RegistrationStatus = EventRegistrationStatus.Closed;
            groupEvent.RegistrationConcurrencyToken = Guid.NewGuid();
        }
        if (executionBlocked)
        {
            groupEvent.ExecutionStatus = EventExecutionStatus.Invalidated;
            groupEvent.ExecutionConcurrencyToken = Guid.NewGuid();
        }
        if (occurrenceExecutionBlocked && affectedOccurrence is not null)
        {
            affectedOccurrence.ExecutionStatus = EventExecutionStatus.Invalidated;
            affectedOccurrence.ExecutionConcurrencyToken = Guid.NewGuid();
            affectedOccurrence.UpdatedUtc = now;
        }


        db.EventTasks.Add(new EventTask
        {
            Id = localReviewCreated && localReviewTaskId.HasValue ? localReviewTaskId.Value : Guid.NewGuid(),
            EventId = groupEvent.Id,
            TitleEn = affectedOccurrenceId.HasValue
                ? $"Review {affectedModuleCode} for one occurrence"
                : affectedModuleCode is null
                ? "Review the Event Package after a material change"
                : $"Review {affectedModuleCode} changes and regenerate the Event Package",
            TitleZh = affectedOccurrenceId.HasValue
                ? $"复查单场次的 {affectedModuleCode} 变化"
                : affectedModuleCode is null
                ? "重大变化后复查活动审批包"
                : $"复查 {affectedModuleCode} 变化并重新生成活动审批包",
            DescriptionEn = affectedOccurrenceId.HasValue
                ? $"Occurrence {affectedOccurrenceId} requires a scoped Package review after {changeCode}; unrelated occurrences retain their baseline approval."
                : $"Approval was invalidated by {changeCode}. Review the authoritative source, resolve blockers, regenerate and resubmit the Package.",
            DescriptionZh = affectedOccurrenceId.HasValue
                ? $"场次 {affectedOccurrenceId} 因 {changeCode} 需要范围化审批包复查；其他场次保留原有基础审批。"
                : $"审批因 {changeCode} 失效。请复查权威来源、处理阻塞项，然后重新生成并提交审批包。",
            AssignedMemberId = groupEvent.AccountableOwnerMemberId,
            Status = EventTaskStatus.Todo, IsRequired = true, RequiresApproval = false,
            CreatedUtc = now, UpdatedUtc = now
        });
        if (groupEvent.AccountableOwnerMemberId != Guid.Empty)
        {
            db.NotificationMessages.Add(new NotificationMessage
            {
                Id = Guid.NewGuid(), RecipientMemberId = groupEvent.AccountableOwnerMemberId,
                CreatedByMemberId = actorMemberId, GroupId = groupEvent.GroupId, EventId = groupEvent.Id,
                OccurredUtc = now, ActionType = localReviewRequired
                    ? "event.package.occurrenceReviewRequired" : "event.package.invalidated",
                ActionDataJson = EventPackageCanonicalizer.Serialize(new
                {
                    eventId = groupEvent.Id, changeCode, affectedModuleCode, affectedOccurrenceId,
                    invalidatedPackageIds = packageIds.Order().ToArray(),
                    baselinePackageIds = localBaselinePackages.Select(x => x.Id).Order().ToArray(),
                    nextAction = localReviewRequired
                        ? "event.package.generateOccurrenceReview" : "event.package.regenerate"
                }),
                CreatedUtc = now, UpdatedUtc = now
            });
        }

        db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            ActorMemberId = actorMemberId,
            Action = "event.package.materialChangeApplied",
            EntityType = "GroupEvent",
            EntityId = groupEvent.Id,
            GroupId = groupEvent.GroupId,
            EventId = groupEvent.Id,
            BeforeJson = EventPackageCanonicalizer.Serialize(new
            {
                activeApprovalCount = packages.Count,
                publicationWasActive = publicationWithdrawn,
                registrationWasOpen = registrationPaused,
                executionWasConfirmed = executionBlocked
            }),
            AfterJson = EventPackageCanonicalizer.Serialize(new
            {
                groupEvent.PublicationStatus,
                groupEvent.RegistrationStatus,
                groupEvent.ExecutionStatus
            }),
            MetadataJson = EventPackageCanonicalizer.Serialize(new
            {
                changeCode,
                classification,
                affectedModuleCode,
                affectedOccurrenceId,
                invalidatedPackageIds = packageIds.Order().ToArray(),
                localBaselinePackageIds = localBaselinePackages.Select(x => x.Id).Order().ToArray(),
                existingEnrollmentsPreserved = true,
                humanNotificationReviewRequired = true
            }),
            OccurredUtc = now
        });

        if (cacheInvalidation is not null)
        {
            await cacheInvalidation.RemoveGroupEventsAsync(groupEvent.GroupId, cancellationToken);
            if (registrationPaused)
                await cacheInvalidation.RemoveEventEnrollmentsAsync(groupEvent.Id, cancellationToken);
        }

        return new(packages.Count, publicationWithdrawn, registrationPaused,
            executionBlocked || occurrenceExecutionBlocked, localReviewRequired);
    }

    private static bool IncludesModule(string manifestJson, string moduleCode)
    {
        try
        {
            using var document = System.Text.Json.JsonDocument.Parse(manifestJson);
            return document.RootElement.TryGetProperty("modules", out var modules) &&
                modules.ValueKind == System.Text.Json.JsonValueKind.Array &&
                modules.EnumerateArray().Any(module =>
                    module.TryGetProperty("moduleCode", out var code) &&
                    string.Equals(code.GetString(), moduleCode, StringComparison.Ordinal));
        }
        catch (System.Text.Json.JsonException)
        {
            return true;
        }
    }

    private static int CoveredOccurrenceCount(string json)
    {
        try
        {
            using var document = System.Text.Json.JsonDocument.Parse(json);
            return document.RootElement.ValueKind == System.Text.Json.JsonValueKind.Array
                ? document.RootElement.GetArrayLength() : 0;
        }
        catch (System.Text.Json.JsonException)
        {
            return 0;
        }
    }
}
