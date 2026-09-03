using System.Text.Json;
using Alife.Application.Admin;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Services;

public sealed class EventPackageService(
    IAlifeDbContext db,
    IGroupAuthorizationService authorization,
    IEventCacheInvalidationService? cacheInvalidation = null) : IEventPackageService
{
    private const string PackageSchemaVersion = "1.0";
    private const string GenerateOperation = "event.package.generate";
    private const string SubmitOperation = "event.package.submit";
    private const string WithdrawOperation = "event.package.withdraw";
    private const string DecideOperation = "event.package.decide";
    private const string PublishOperation = "event.publish";
    private const string UnpublishOperation = "event.unpublish";
    private const string RevokeOperation = "event.package.decision.revoke";
    private const string SatisfyConditionOperation = "event.package.condition.satisfy";
    private const string VerifyConditionOperation = "event.package.condition.verify";
    private const string WaiveConditionOperation = "event.package.condition.waive";
    private const string OpenRegistrationOperation = "event.registration.open";
    private const string CloseRegistrationOperation = "event.registration.close";
    private const string ConfirmExecutionOperation = "event.execution.confirm";
    private const int ConditionEvidenceRetentionDaysAfterEvent = 90;
    private static readonly JsonSerializerOptions JsonOptions = EventCompositionEngine.CreateJsonOptions();
    private static readonly IReadOnlySet<string> UnavailableModules = new HashSet<string>(StringComparer.Ordinal)
    {
        "MONEY.FINANCE", "FOOD.HOSPITALITY", "FESTIVAL.OPERATIONS"
    };
    private static readonly IReadOnlySet<string> OccurrenceVersionedModules = new HashSet<string>(StringComparer.Ordinal)
    {
        "SERVICE.ROSTER", "PROGRAM.PRODUCTION", "PLACE.RESOURCE", "MOVE.STAY"
    };

    public async Task<AppResult<EventPackagePageDto>> ListAsync(
        Guid eventId, Guid memberId, ListEventPackagesRequest request, CancellationToken ct)
    {
        var access = await LoadViewableEvent(eventId, memberId, ct);
        if (!access.IsSuccess) return Failure<EventPackagePageDto, GroupEvent>(access);
        if (request.Page < 1 || request.PageSize is < 1 or > 100)
            return AppResult<EventPackagePageDto>.Validation("page must be positive and pageSize must be between 1 and 100.");
        if (request.Sort is not ("versionDesc" or "versionAsc" or "generatedDesc" or "generatedAsc"))
            return AppResult<EventPackagePageDto>.Validation("sort must be versionDesc, versionAsc, generatedDesc or generatedAsc.");
        if (request.ScopeId.HasValue && request.ScopeType != EventPackageScopeType.Occurrence)
            return AppResult<EventPackagePageDto>.Validation("scopeId requires scopeType=occurrence.");
        await ExpireOverdueConditionsAsync(eventId, access.Value!.GroupId, ct);
        var query = db.EventPackages.AsNoTracking().Where(x => x.EventId == eventId);
        if (request.Status.HasValue) query = query.Where(x => x.Status == request.Status.Value);
        if (request.ScopeType.HasValue) query = query.Where(x => x.ScopeType == request.ScopeType.Value);
        if (request.ScopeId.HasValue) query = query.Where(x => x.ScopeId == request.ScopeId.Value);
        var totalCount = await query.CountAsync(ct);
        query = request.Sort switch
        {
            "versionAsc" => query.OrderBy(x => x.Version),
            "generatedDesc" => query.OrderByDescending(x => x.GeneratedUtc).ThenByDescending(x => x.Version),
            "generatedAsc" => query.OrderBy(x => x.GeneratedUtc).ThenBy(x => x.Version),
            _ => query.OrderByDescending(x => x.Version)
        };
        var packages = await query.Include(x => x.SourceReferences).Include(x => x.Decisions)
            .Include(x => x.Conditions).Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize).ToListAsync(ct);
        return AppResult<EventPackagePageDto>.Success(new(
            packages.Select(ToDto).ToArray(), request.Page, request.PageSize, totalCount));
    }

    public async Task<AppResult<EventPackageDto>> GetCurrentAsync(Guid eventId, Guid memberId,
        EventPackageScopeType scopeType, Guid? scopeId, CancellationToken ct)
    {
        var access = await LoadViewableEvent(eventId, memberId, ct);
        if (!access.IsSuccess) return Failure<EventPackageDto, GroupEvent>(access);
        await ExpireOverdueConditionsAsync(eventId, access.Value!.GroupId, ct);
        if ((scopeType == EventPackageScopeType.Event && scopeId.HasValue) ||
            (scopeType == EventPackageScopeType.Occurrence && !scopeId.HasValue))
            return AppResult<EventPackageDto>.Validation("scopeType and scopeId do not form a valid Package scope.");
        var package = await db.EventPackages.AsNoTracking().Where(x => x.EventId == eventId &&
                x.ScopeType == scopeType && x.ScopeId == scopeId)
            .Include(x => x.SourceReferences).Include(x => x.Decisions).Include(x => x.Conditions)
            .OrderByDescending(x => x.Version).FirstOrDefaultAsync(ct);
        return package is null
            ? AppResult<EventPackageDto>.NotFound("No Event Package has been generated.")
            : AppResult<EventPackageDto>.Success(ToDto(package));
    }

    public async Task<AppResult<EventPackageDto>> GetAsync(Guid eventId, Guid packageId, Guid memberId, CancellationToken ct)
    {
        var access = await LoadViewableEvent(eventId, memberId, ct);
        if (!access.IsSuccess) return Failure<EventPackageDto, GroupEvent>(access);
        await ExpireOverdueConditionsAsync(eventId, access.Value!.GroupId, ct);
        var package = await db.EventPackages.AsNoTracking()
            .Include(x => x.SourceReferences).Include(x => x.Decisions).Include(x => x.Conditions)
            .FirstOrDefaultAsync(x => x.Id == packageId && x.EventId == eventId, ct);
        return package is null
            ? AppResult<EventPackageDto>.NotFound("Event Package not found.")
            : AppResult<EventPackageDto>.Success(ToDto(package));
    }

    public async Task<AppResult<EventPackageDiffDto>> DiffAsync(Guid eventId, Guid packageId, Guid otherPackageId,
        Guid memberId, CancellationToken ct)
    {
        var access = await LoadViewableEvent(eventId, memberId, ct);
        if (!access.IsSuccess) return Failure<EventPackageDiffDto, GroupEvent>(access);
        var compared = await PackageQuery(asNoTracking: true)
            .Where(x => x.EventId == eventId && (x.Id == packageId || x.Id == otherPackageId))
            .ToListAsync(ct);
        var from = compared.FirstOrDefault(x => x.Id == packageId);
        var to = compared.FirstOrDefault(x => x.Id == otherPackageId);
        if (from is null || to is null)
            return AppResult<EventPackageDiffDto>.NotFound("Both Event Package versions are required for comparison.");

        EventPackageManifestDto? fromManifest;
        EventPackageManifestDto? toManifest;
        try
        {
            fromManifest = JsonSerializer.Deserialize<EventPackageManifestDto>(from.ManifestJson, JsonOptions);
            toManifest = JsonSerializer.Deserialize<EventPackageManifestDto>(to.ManifestJson, JsonOptions);
        }
        catch (JsonException)
        {
            return AppResult<EventPackageDiffDto>.Conflict("An Event Package manifest is invalid.");
        }
        if (fromManifest is null || toManifest is null)
            return AppResult<EventPackageDiffDto>.Conflict("An Event Package manifest is missing.");

        var changes = BuildDiff(from, fromManifest, to, toManifest);
        return AppResult<EventPackageDiffDto>.Success(new(from.Id, from.Version, to.Id, to.Version,
            changes.Any(x => x.Classification != "cosmetic"), changes));
    }

    public async Task<AppResult<EventPackageActorCapabilitiesDto>> GetCapabilitiesAsync(
        Guid eventId, Guid packageId, Guid memberId, CancellationToken ct)
    {
        var access = await LoadViewableEvent(eventId, memberId, ct);
        if (!access.IsSuccess) return Failure<EventPackageActorCapabilitiesDto, GroupEvent>(access);
        await ExpireOverdueConditionsAsync(eventId, access.Value!.GroupId, ct);
        var package = await PackageQuery(asNoTracking: true)
            .FirstOrDefaultAsync(x => x.Id == packageId && x.EventId == eventId, ct);
        if (package is null)
            return AppResult<EventPackageActorCapabilitiesDto>.NotFound("Event Package not found.");

        var groupEvent = access.Value;
        var now = DateTime.UtcNow;
        var canManageEvent = await EventCompositionPersistence.CanManageEventAsync(
            db, authorization, groupEvent, memberId, ct);
        var canSubmitAuthority = await CanSubmitAsync(groupEvent, memberId, ct);
        var decisionAuthority = await ResolveDecisionAuthorityAsync(groupEvent, package, memberId, ct);
        var canOpenRegistrationAuthority = await CanManageRegistrationAsync(
            groupEvent, memberId, allowGroupLeadership: false, ct);
        var canCloseRegistrationAuthority = await CanManageRegistrationAsync(
            groupEvent, memberId, allowGroupLeadership: true, ct);
        var canConfirmExecutionAuthority = await CanConfirmExecutionAsync(groupEvent, memberId, ct);
        var canManageDelegations = await EventCompositionPersistence.HasDirectGroupLeadershipAsync(
                db, groupEvent.GroupId, memberId, ct) ||
            await AdminPlatformRoleHelpers.HasPermissionAsync(
                db, memberId, AdminPermissionCatalog.ManageEventPackagePolicies, ct);
        var acceptedRoles = await db.EventRoleAssignments.AsNoTracking()
            .Where(x => x.EventId == eventId && x.MemberId == memberId &&
                x.Status == EventRoleAssignmentStatus.Accepted && x.EndedUtc == null)
            .Select(x => x.RoleRequirementKey).ToHashSetAsync(ct);
        var policy = await db.EventPackageGovernancePolicyVersions.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == package.GovernancePolicyVersionId, ct);
        var waiverAllowed = policy is not null && ReadConditionWaiverAllowed(policy.RulesJson);
        var packageActive = package.Status == EventPackageStatus.ApprovedWithConditions &&
            package.ApprovalValidityStatus == EventPackageApprovalValidity.Active;
        var conditionCapabilities = package.Conditions.OrderBy(x => x.DueUtc).ThenBy(x => x.Id).Select(condition =>
        {
            var unresolved = condition.Status is not (EventPackageConditionStatus.Verified or EventPackageConditionStatus.Waived);
            var beforeDue = condition.DueUtc > now;
            var ownsCondition = acceptedRoles.Contains(condition.OwnerRoleRequirementKey);
            return new EventPackageConditionActorCapabilitiesDto(
                condition.Id,
                packageActive && beforeDue && ownsCondition &&
                    condition.Status is EventPackageConditionStatus.Open or EventPackageConditionStatus.Rejected,
                packageActive && beforeDue && decisionAuthority.Allowed &&
                    condition.Status == EventPackageConditionStatus.EvidenceSubmitted &&
                    (package.GovernanceTier == EventGovernanceTier.Light || condition.SatisfiedByMemberId != memberId),
                packageActive && unresolved && waiverAllowed && decisionAuthority.Allowed && !ownsCondition &&
                    condition.SatisfiedByMemberId != memberId && condition.VerifiedByMemberId != memberId);
        }).ToArray();
        var hasRevocableApproval = package.Decisions.Any(x =>
            x.DecisionType is EventPackageDecisionType.Approve or EventPackageDecisionType.ApproveWithConditions &&
            x.InvalidatedReasonCode == null && (!x.ExpiresUtc.HasValue || x.ExpiresUtc > now) &&
            !package.Decisions.Any(revocation => revocation.DecisionType == EventPackageDecisionType.Revoke &&
                revocation.RevokedByDecisionId == x.Id));

        return AppResult<EventPackageActorCapabilitiesDto>.Success(new(
            eventId,
            packageId,
            canManageEvent,
            package.Status == EventPackageStatus.Draft && canSubmitAuthority,
            package.Status is EventPackageStatus.Draft or EventPackageStatus.Submitted &&
                (package.GeneratedByMemberId == memberId || package.SubmittedByMemberId == memberId || canManageEvent),
            package.Status == EventPackageStatus.Submitted && decisionAuthority.Allowed,
            package.ApprovalValidityStatus == EventPackageApprovalValidity.Active && hasRevocableApproval && decisionAuthority.Allowed,
            canManageEvent && package.Status is EventPackageStatus.Approved or EventPackageStatus.ApprovedWithConditions,
            canManageEvent && groupEvent.PublicationStatus is EventPublicationStatus.Published or EventPublicationStatus.LegacyImplicit,
            canOpenRegistrationAuthority && groupEvent.RegistrationStatus != EventRegistrationStatus.Open,
            canCloseRegistrationAuthority && groupEvent.RegistrationStatus != EventRegistrationStatus.Closed,
            canConfirmExecutionAuthority && groupEvent.ExecutionStatus != EventExecutionStatus.Confirmed,
            canManageDelegations,
            conditionCapabilities));
    }

    public async Task<AppResult<EventPackageDto>> GenerateAsync(
        Guid eventId,
        Guid memberId,
        GenerateEventPackageRequest request,
        string? ifMatch,
        string? idempotencyKey,
        CancellationToken ct)
    {
        if (!string.Equals(request.PackageSchemaVersion, PackageSchemaVersion, StringComparison.Ordinal))
            return AppResult<EventPackageDto>.Validation($"Package schema {request.PackageSchemaVersion} is not supported.");
        var keyError = ValidateIdempotencyKey(idempotencyKey);
        if (keyError is not null) return AppResult<EventPackageDto>.Validation(keyError);
        var groupEvent = await db.GroupEvents.FirstOrDefaultAsync(x => x.Id == eventId, ct);
        if (groupEvent is null) return AppResult<EventPackageDto>.NotFound("Event not found.");
        if (!await EventCompositionPersistence.CanManageEventAsync(db, authorization, groupEvent, memberId, ct))
            return AppResult<EventPackageDto>.Forbidden("The accountable owner or owning-group leadership is required to generate an Event Package.");

        var normalizedKey = idempotencyKey!.Trim();
        var requestHash = EventPackageCanonicalizer.HashCanonical(new { eventId, memberId, request });
        var existingKey = await db.EventIdempotencyRecords.AsNoTracking().FirstOrDefaultAsync(
            x => x.Operation == GenerateOperation && x.ScopeId == eventId && x.Key == normalizedKey, ct);
        if (existingKey is not null)
        {
            if (!string.Equals(existingKey.RequestHash, requestHash, StringComparison.Ordinal))
                return AppResult<EventPackageDto>.Conflict("The Idempotency-Key was already used with a different Package request.");
            var existing = await PackageQuery(asNoTracking: true)
                .FirstOrDefaultAsync(x => x.Id == existingKey.ResultEntityId, ct);
            return existing is null
                ? AppResult<EventPackageDto>.Conflict("The idempotent Package result is no longer available.")
                : AppResult<EventPackageDto>.Success(ToDto(existing));
        }

        await using var transaction = await db.BeginSerializableTransactionAsync(ct);
        var first = await CaptureAsync(groupEvent.Id, request, ct);
        if (!first.IsSuccess) return Failure<EventPackageDto, PackageCapture>(first);
        if (!Matches(ifMatch, first.Value!.Plan.ETag))
            return AppResult<EventPackageDto>.PreconditionFailed("The accepted Event Plan changed; reload before generating the Package.");
        var second = await CaptureAsync(groupEvent.Id, request, ct);
        if (!second.IsSuccess) return Failure<EventPackageDto, PackageCapture>(second);
        if (!string.Equals(first.Value.SourceVectorHash, second.Value!.SourceVectorHash, StringComparison.Ordinal) ||
            first.Value.Plan.PlanVersion != second.Value.Plan.PlanVersion || first.Value.Policy.Id != second.Value.Policy.Id)
            return AppResult<EventPackageDto>.Conflict("event.package.sourceChanged");

        var latest = await db.EventPackages.AsNoTracking().Where(x => x.EventId == eventId &&
                x.ScopeType == request.ScopeType && x.ScopeId == request.ScopeId)
            .OrderByDescending(x => x.Version).FirstOrDefaultAsync(ct);
        var version = (latest?.Version ?? 0) + 1;
        var now = DateTime.UtcNow;
        var packageId = Guid.NewGuid();
        var manifestJson = EventPackageCanonicalizer.Serialize(second.Value.Manifest);
        var contentHash = EventPackageCanonicalizer.HashCanonical(new
        {
            schema = PackageSchemaVersion,
            scope = new { request.ScopeType, request.ScopeId, second.Value.Manifest.CoverageMode, second.Value.Manifest.CoveredOccurrenceIds },
            plan = new { second.Value.Plan.PlanVersion, second.Value.Plan.ETag },
            policy = new { second.Value.Policy.Id, second.Value.Policy.Version, rulesHash = EventPackageCanonicalizer.HashCanonical(JsonDocument.Parse(second.Value.Policy.RulesJson).RootElement) },
            sourceVectorHash = second.Value.SourceVectorHash,
            manifest = second.Value.Manifest
        });
        var package = new EventPackage
        {
            Id = packageId,
            EventId = eventId,
            ScopeType = request.ScopeType,
            ScopeId = request.ScopeId,
            CoverageMode = second.Value.Manifest.CoverageMode,
            CoveredOccurrenceIdsJson = EventPackageCanonicalizer.Serialize(second.Value.Manifest.CoveredOccurrenceIds),
            Version = version,
            EventPlanVersion = second.Value.Plan.PlanVersion,
            PackageSchemaVersion = PackageSchemaVersion,
            GovernancePolicyVersionId = second.Value.Policy.Id,
            GovernancePolicyVersion = second.Value.Policy.Version,
            GovernanceTier = second.Value.Manifest.GovernanceTier,
            Status = EventPackageStatus.Draft,
            ApprovalValidityStatus = EventPackageApprovalValidity.NotDecided,
            ContentHash = contentHash,
            SourceVectorHash = second.Value.SourceVectorHash,
            ManifestJson = manifestJson,
            SupersedesPackageId = latest?.Id,
            GeneratedByMemberId = memberId,
            GeneratedUtc = now
        };
        package.SourceReferences = second.Value.Sources.Select(source => new EventPackageSourceReference
        {
            Id = Guid.NewGuid(), EventPackageId = packageId, ModuleCode = source.ModuleCode,
            SubjectType = source.SubjectType, SubjectId = source.SubjectId, SubjectVersion = source.SubjectVersion,
            SourceDecisionId = source.SourceDecisionId, ValidUntilUtc = source.ValidUntilUtc,
            DataClass = source.DataClass, RequiredForDecision = source.RequiredForDecision, CapturedUtc = now
        }).ToArray();
        db.EventPackages.Add(package);
        db.EventIdempotencyRecords.Add(new EventIdempotencyRecord
        {
            Id = Guid.NewGuid(), Operation = GenerateOperation, ScopeId = eventId, Key = normalizedKey,
            RequestHash = requestHash, ResultEntityId = packageId, CreatedUtc = now, ExpiresUtc = now.AddHours(24)
        });
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException) { return AppResult<EventPackageDto>.Conflict("event.package.sourceChanged"); }
        catch (DbUpdateException) { return AppResult<EventPackageDto>.Conflict("The Package version or idempotency key was created by another request; reload and retry."); }
        if (transaction is not null) await transaction.CommitAsync(ct);
        return AppResult<EventPackageDto>.Success(ToDto(package));
    }

    public async Task<AppResult<EventPackageDto>> SubmitAsync(Guid eventId, Guid packageId, Guid memberId,
        string? ifMatch, string? idempotencyKey, CancellationToken ct)
    {
        var access = await LoadViewableEvent(eventId, memberId, ct);
        if (!access.IsSuccess) return Failure<EventPackageDto, GroupEvent>(access);
        var keyError = ValidateIdempotencyKey(idempotencyKey);
        if (keyError is not null) return AppResult<EventPackageDto>.Validation(keyError);
        var requestHash = EventPackageCanonicalizer.HashCanonical(new { eventId, packageId, memberId });
        var replay = await ReplayAsync(SubmitOperation, packageId, idempotencyKey!, requestHash, ct);
        if (replay is not null) return replay;

        await using var transaction = await db.BeginSerializableTransactionAsync(ct);
        var package = await PackageQuery().FirstOrDefaultAsync(x => x.Id == packageId && x.EventId == eventId, ct);
        if (package is null) return AppResult<EventPackageDto>.NotFound("Event Package not found.");
        var groupEvent = await db.GroupEvents.FirstOrDefaultAsync(x => x.Id == eventId, ct);
        if (groupEvent is null) return AppResult<EventPackageDto>.NotFound("Event not found.");
        if (!await CanSubmitAsync(groupEvent, memberId, ct))
            return AppResult<EventPackageDto>.Forbidden("The accountable owner, accepted Event Lead, or owning-group leadership is required to submit this Package.");
        if (!Matches(ifMatch, ETag(package)))
            return AppResult<EventPackageDto>.PreconditionFailed("The Event Package changed; reload before submitting.");
        if (package.Status != EventPackageStatus.Draft)
            return AppResult<EventPackageDto>.Conflict("Only a draft Event Package can be submitted.");

        EventPackageManifestDto manifest;
        try { manifest = JsonSerializer.Deserialize<EventPackageManifestDto>(package.ManifestJson, JsonOptions)!; }
        catch (JsonException) { return AppResult<EventPackageDto>.Conflict("The Event Package manifest is invalid."); }
        // Manifest-level blockers prevent freezing the Package. Module readiness blockers remain visible
        // to approvers and lifecycle gates, because specialist work may continue while a Package is under review.
        if (manifest is null || manifest.Blockers.Count > 0)
            return AppResult<EventPackageDto>.Conflict("event.package.submissionBlocked");
        var current = await CaptureAsync(eventId,
            new GenerateEventPackageRequest(package.ScopeType, package.ScopeId, package.PackageSchemaVersion), ct);
        if (!current.IsSuccess) return Failure<EventPackageDto, PackageCapture>(current);
        if (!string.Equals(current.Value!.SourceVectorHash, package.SourceVectorHash, StringComparison.Ordinal) ||
            current.Value.Plan.PlanVersion != package.EventPlanVersion || current.Value.Policy.Id != package.GovernancePolicyVersionId)
            return AppResult<EventPackageDto>.Conflict("event.package.sourceChanged");

        var now = DateTime.UtcNow;
        package.Status = EventPackageStatus.Submitted;
        package.SubmittedByMemberId = memberId;
        package.SubmittedUtc = now;
        package.ConcurrencyToken = Guid.NewGuid();
        AddAudit("event.package.submitted", groupEvent, memberId, package, now,
            new { status = EventPackageStatus.Draft }, new { status = package.Status, package.SubmittedUtc });
        AddIdempotency(SubmitOperation, packageId, idempotencyKey!, requestHash, packageId, now);
        AddNotifications(await ResolveApprovalNotificationRecipientsAsync(groupEvent, package, ct), memberId,
            groupEvent, package, "event.package.submitted", now,
            new { package.Status, package.GovernanceTier, nextAction = "event.package.decide" });
        var saved = await SavePackageAsync(package, transaction, ct);
        return saved;
    }

    public async Task<AppResult<EventPackageDto>> WithdrawAsync(Guid eventId, Guid packageId, Guid memberId,
        string? ifMatch, string? idempotencyKey, CancellationToken ct)
    {
        var access = await LoadViewableEvent(eventId, memberId, ct);
        if (!access.IsSuccess) return Failure<EventPackageDto, GroupEvent>(access);
        var keyError = ValidateIdempotencyKey(idempotencyKey);
        if (keyError is not null) return AppResult<EventPackageDto>.Validation(keyError);
        var requestHash = EventPackageCanonicalizer.HashCanonical(new { eventId, packageId, memberId });
        var replay = await ReplayAsync(WithdrawOperation, packageId, idempotencyKey!, requestHash, ct);
        if (replay is not null) return replay;

        await using var transaction = await db.BeginSerializableTransactionAsync(ct);
        var package = await PackageQuery().FirstOrDefaultAsync(x => x.Id == packageId && x.EventId == eventId, ct);
        if (package is null) return AppResult<EventPackageDto>.NotFound("Event Package not found.");
        var groupEvent = await db.GroupEvents.FirstOrDefaultAsync(x => x.Id == eventId, ct);
        if (groupEvent is null) return AppResult<EventPackageDto>.NotFound("Event not found.");
        var mayWithdraw = package.GeneratedByMemberId == memberId || package.SubmittedByMemberId == memberId ||
            await EventCompositionPersistence.CanManageEventAsync(db, authorization, groupEvent, memberId, ct);
        if (!mayWithdraw) return AppResult<EventPackageDto>.Forbidden("The Package submitter or an Event manager is required to withdraw this Package.");
        if (!Matches(ifMatch, ETag(package)))
            return AppResult<EventPackageDto>.PreconditionFailed("The Event Package changed; reload before withdrawing.");
        if (package.Status is not (EventPackageStatus.Draft or EventPackageStatus.Submitted))
            return AppResult<EventPackageDto>.Conflict("Only a draft or submitted Event Package can be withdrawn.");

        var previousStatus = package.Status;
        var now = DateTime.UtcNow;
        package.Status = EventPackageStatus.Withdrawn;
        package.ApprovalValidityStatus = EventPackageApprovalValidity.NotDecided;
        package.ConcurrencyToken = Guid.NewGuid();
        AddAudit("event.package.withdrawn", groupEvent, memberId, package, now,
            new { status = previousStatus }, new { status = package.Status });
        AddIdempotency(WithdrawOperation, packageId, idempotencyKey!, requestHash, packageId, now);
        return await SavePackageAsync(package, transaction, ct);
    }

    public async Task<AppResult<EventPackageDto>> DecideAsync(Guid eventId, Guid packageId, Guid memberId,
        EventPackageDecisionRequest request, string? ifMatch, string? idempotencyKey, CancellationToken ct)
    {
        var access = await LoadViewableEvent(eventId, memberId, ct);
        if (!access.IsSuccess) return Failure<EventPackageDto, GroupEvent>(access);
        var validation = ValidateDecision(request);
        if (validation is not null) return AppResult<EventPackageDto>.Validation(validation);
        var keyError = ValidateIdempotencyKey(idempotencyKey);
        if (keyError is not null) return AppResult<EventPackageDto>.Validation(keyError);
        var requestHash = EventPackageCanonicalizer.HashCanonical(new { eventId, packageId, memberId, request });
        var replay = await ReplayAsync(DecideOperation, packageId, idempotencyKey!, requestHash, ct);
        if (replay is not null) return replay;

        await using var transaction = await db.BeginSerializableTransactionAsync(ct);
        var package = await PackageQuery().FirstOrDefaultAsync(x => x.Id == packageId && x.EventId == eventId, ct);
        if (package is null) return AppResult<EventPackageDto>.NotFound("Event Package not found.");
        var groupEvent = await db.GroupEvents.FirstOrDefaultAsync(x => x.Id == eventId, ct);
        if (groupEvent is null) return AppResult<EventPackageDto>.NotFound("Event not found.");
        if (!Matches(ifMatch, ETag(package)))
            return AppResult<EventPackageDto>.PreconditionFailed("The Event Package changed; reload before deciding.");
        if (package.Status != EventPackageStatus.Submitted)
            return AppResult<EventPackageDto>.Conflict("Only a submitted Event Package can receive a final decision.");
        if (request.DecisionType is EventPackageDecisionType.Revoke or EventPackageDecisionType.ConditionWaiver)
            return AppResult<EventPackageDto>.Validation(
                "Revocations and condition waivers must use their dedicated append-only operations.");

        var authority = await ResolveDecisionAuthorityAsync(groupEvent, package, memberId, ct);
        if (!authority.Allowed) return AppResult<EventPackageDto>.Forbidden(authority.DenialReason!);
        var current = await CaptureAsync(eventId,
            new GenerateEventPackageRequest(package.ScopeType, package.ScopeId, package.PackageSchemaVersion), ct);
        if (!current.IsSuccess) return Failure<EventPackageDto, PackageCapture>(current);
        if (!string.Equals(current.Value!.SourceVectorHash, package.SourceVectorHash, StringComparison.Ordinal) ||
            current.Value.Plan.PlanVersion != package.EventPlanVersion || current.Value.Policy.Id != package.GovernancePolicyVersionId)
            return AppResult<EventPackageDto>.Conflict("event.package.sourceChanged");

        var now = DateTime.UtcNow;
        DateTime? decisionExpiresUtc = request.ExpiresUtc.HasValue ? AsUtc(request.ExpiresUtc.Value) : null;
        if (request.DecisionType is EventPackageDecisionType.Approve or EventPackageDecisionType.ApproveWithConditions)
        {
            var policyExpiry = ResolveApprovalExpiry(current.Value.Policy.RulesJson, package.GovernanceTier, now);
            if (!policyExpiry.HasValue)
                return AppResult<EventPackageDto>.Conflict("The Package policy does not define a valid approval duration for this tier.");
            if (decisionExpiresUtc.HasValue && decisionExpiresUtc > policyExpiry.Value)
                return AppResult<EventPackageDto>.Validation("The requested approval expiry exceeds the policy maximum.");
            decisionExpiresUtc ??= policyExpiry;
            if (request.Conditions?.Any(x => AsUtc(x.DueUtc) > decisionExpiresUtc.Value) == true)
                return AppResult<EventPackageDto>.Validation("A condition due time cannot exceed the approval validity window.");
        }
        var minimumApproverCount = ResolveMinimumApproverCount(current.Value.Policy.RulesJson, package.GovernanceTier);
        if (!minimumApproverCount.HasValue)
            return AppResult<EventPackageDto>.Conflict("The Package policy does not define a valid approval quorum for this tier.");
        if (request.DecisionType is EventPackageDecisionType.Approve or EventPackageDecisionType.ApproveWithConditions &&
            package.Decisions.Any(x => x.ActorMemberId == memberId &&
                x.DecisionType is EventPackageDecisionType.Approve or EventPackageDecisionType.ApproveWithConditions &&
                !package.Decisions.Any(revocation => revocation.DecisionType == EventPackageDecisionType.Revoke &&
                    revocation.RevokedByDecisionId == x.Id)))
            return AppResult<EventPackageDto>.Conflict("This approver already contributed an active decision to the quorum.");
        var approvalCountAfterDecision = request.DecisionType is EventPackageDecisionType.Approve or EventPackageDecisionType.ApproveWithConditions
            ? package.Decisions.Count(x => x.DecisionType is EventPackageDecisionType.Approve or EventPackageDecisionType.ApproveWithConditions &&
                x.InvalidatedReasonCode == null && (!x.ExpiresUtc.HasValue || x.ExpiresUtc > now) &&
                !package.Decisions.Any(revocation => revocation.DecisionType == EventPackageDecisionType.Revoke && revocation.RevokedByDecisionId == x.Id)) + 1
            : 0;
        var quorumReached = approvalCountAfterDecision >= minimumApproverCount.Value;
        var decision = new EventPackageDecision
        {
            Id = Guid.NewGuid(), EventPackageId = package.Id, DecisionType = request.DecisionType,
            ActorMemberId = memberId, ReasonEn = request.Reason.En.Trim(), ReasonZh = request.Reason.Zh.Trim(),
            DecidedUtc = now, EffectiveUtc = now, ExpiresUtc = decisionExpiresUtc,
            DecisionAuthoritySnapshotJson = EventPackageCanonicalizer.Serialize(new
            {
                package.GovernanceTier, authority.AuthorityCode, authority.AuthorityGroupId,
                separationFromSubmitter = package.GovernanceTier != EventGovernanceTier.Light,
                package.GovernancePolicyVersion, minimumApproverCount, approvalCountAfterDecision, quorumReached
            }),
            RequestHash = requestHash
        };
        db.EventPackageDecisions.Add(decision);
        if (request.DecisionType == EventPackageDecisionType.ApproveWithConditions)
        {
            foreach (var input in request.Conditions!)
            {
                var assignedMemberId = await db.EventRoleAssignments.AsNoTracking()
                    .Where(x => x.EventId == eventId && x.RoleRequirementKey == input.OwnerRoleRequirementKey.Trim() &&
                        x.Status == EventRoleAssignmentStatus.Accepted && x.EndedUtc == null)
                    .OrderBy(x => x.Id).Select(x => (Guid?)x.MemberId).FirstOrDefaultAsync(ct);
                var conditionId = Guid.NewGuid();
                var task = new EventTask
                {
                    Id = Guid.NewGuid(), EventId = eventId,
                    TitleEn = $"Resolve {input.AppliesToGate} approval condition",
                    TitleZh = $"落实 {input.AppliesToGate} 审批条件",
                    DescriptionEn = $"Open Event Package v{package.Version} and submit evidence through its authoritative condition.",
                    DescriptionZh = $"打开活动方案审批包 v{package.Version}，通过其中的权威条件提交证据。",
                    AssignedMemberId = assignedMemberId, Status = EventTaskStatus.Todo,
                    IsRequired = true, RequiresApproval = true, IsRestricted = true,
                    DueUtc = AsUtc(input.DueUtc), CreatedUtc = now, UpdatedUtc = now
                };
                var condition = new EventPackageCondition
                {
                    Id = conditionId, EventPackageId = package.Id, ReadinessTaskId = task.Id,
                    TextEn = input.Text.En.Trim(), TextZh = input.Text.Zh.Trim(),
                    AppliesToGate = input.AppliesToGate, OwnerRoleRequirementKey = input.OwnerRoleRequirementKey.Trim(),
                    DueUtc = AsUtc(input.DueUtc), Status = EventPackageConditionStatus.Open
                };
                db.EventTasks.Add(task);
                db.EventPackageConditions.Add(condition);
            }
        }
        package.Status = request.DecisionType switch
        {
            EventPackageDecisionType.Approve when quorumReached && package.Conditions.Count == 0 => EventPackageStatus.Approved,
            EventPackageDecisionType.Approve when quorumReached => EventPackageStatus.ApprovedWithConditions,
            EventPackageDecisionType.ApproveWithConditions when quorumReached => EventPackageStatus.ApprovedWithConditions,
            EventPackageDecisionType.Approve or EventPackageDecisionType.ApproveWithConditions => EventPackageStatus.Submitted,
            EventPackageDecisionType.ReturnForAmendment => EventPackageStatus.ReturnedForAmendment,
            EventPackageDecisionType.Reject => EventPackageStatus.Rejected,
            _ => package.Status
        };
        package.ApprovalValidityStatus = request.DecisionType is EventPackageDecisionType.Approve or EventPackageDecisionType.ApproveWithConditions && quorumReached
            ? EventPackageApprovalValidity.Active : EventPackageApprovalValidity.NotDecided;
        package.ConcurrencyToken = Guid.NewGuid();
        if (package.ScopeType == EventPackageScopeType.Occurrence && package.ScopeId.HasValue &&
            package.ApprovalValidityStatus == EventPackageApprovalValidity.Active)
        {
            var occurrence = await db.EventOccurrences.FirstOrDefaultAsync(x =>
                x.Id == package.ScopeId.Value && x.EventId == eventId, ct);
            if (occurrence is not null && EventOccurrencePackageExceptionState.HasOpen(occurrence.ExceptionsJson))
            {
                occurrence.ExceptionsJson = EventOccurrencePackageExceptionState.Resolve(
                    occurrence.ExceptionsJson, package.Id, now, out var reviewTaskIds);
                occurrence.UpdatedUtc = now;
                if (reviewTaskIds.Count > 0)
                {
                    var reviewTasks = await db.EventTasks.Where(x => reviewTaskIds.Contains(x.Id)).ToListAsync(ct);
                    foreach (var task in reviewTasks)
                    {
                        task.Status = EventTaskStatus.Done;
                        task.CompletedUtc = now;
                        task.UpdatedUtc = now;
                        task.ConcurrencyToken = Guid.NewGuid();
                    }
                }
                AddAudit("event.package.occurrenceReviewResolved", groupEvent, memberId, package, now,
                    new { occurrenceId = occurrence.Id, reviewStatus = "open" },
                    new { occurrenceId = occurrence.Id, reviewStatus = "resolved", reviewTaskIds });
            }
        }
        AddAudit("event.package.decided", groupEvent, memberId, package, now,
            new { status = EventPackageStatus.Submitted, validity = EventPackageApprovalValidity.NotDecided },
            new { status = package.Status, validity = package.ApprovalValidityStatus, request.DecisionType,
                decisionId = decision.Id, minimumApproverCount, approvalCountAfterDecision, quorumReached });
        AddIdempotency(DecideOperation, packageId, idempotencyKey!, requestHash, packageId, now);
        var decisionNotificationRecipients = new HashSet<Guid>(
            new[] { (Guid?)groupEvent.AccountableOwnerMemberId, package.SubmittedByMemberId,
                package.GeneratedByMemberId }.Where(x => x.HasValue).Select(x => x!.Value));
        if (request.DecisionType == EventPackageDecisionType.ApproveWithConditions)
        {
            var ownerRoleKeys = request.Conditions!.Select(x => x.OwnerRoleRequirementKey.Trim()).Distinct().ToArray();
            decisionNotificationRecipients.UnionWith(await db.EventRoleAssignments.AsNoTracking()
                .Where(x => x.EventId == eventId && ownerRoleKeys.Contains(x.RoleRequirementKey) &&
                    x.Status == EventRoleAssignmentStatus.Accepted && x.EndedUtc == null)
                .Select(x => x.MemberId).ToListAsync(ct));
        }
        AddNotifications(decisionNotificationRecipients,
            memberId, groupEvent, package, "event.package.decided", now,
            new { request.DecisionType, package.Status, package.ApprovalValidityStatus, quorumReached });
        return await SavePackageAsync(package, transaction, ct);
    }

    public async Task<AppResult<EventLifecycleDto>> GetLifecycleAsync(
        Guid eventId, Guid memberId, CancellationToken ct, Guid? occurrenceId = null)
    {
        var access = await LoadViewableEvent(eventId, memberId, ct);
        if (!access.IsSuccess) return Failure<EventLifecycleDto, GroupEvent>(access);
        await ExpireOverdueConditionsAsync(eventId, access.Value!.GroupId, ct);
        var groupEvent = await LifecycleEventQuery(asNoTracking: true).FirstAsync(x => x.Id == eventId, ct);
        var now = DateTime.UtcNow;
        var policy = await CurrentPolicyAsync(groupEvent.GroupId, now, ct);
        EventOccurrence? requestedOccurrence = null;
        if (occurrenceId.HasValue)
        {
            requestedOccurrence = await db.EventOccurrences.AsNoTracking().FirstOrDefaultAsync(x =>
                x.Id == occurrenceId.Value && x.EventId == eventId && x.Status != EventOccurrenceStatus.Cancelled, ct);
            if (requestedOccurrence is null)
                return AppResult<EventLifecycleDto>.Validation("The requested lifecycle occurrence is unavailable.");
        }
        var candidate = occurrenceId.HasValue
            ? await PackageQuery(asNoTracking: true).Where(x => x.EventId == eventId &&
                    ((x.ScopeType == EventPackageScopeType.Occurrence && x.ScopeId == occurrenceId) ||
                     (x.ScopeType == EventPackageScopeType.Event && x.ScopeId == null)))
                .OrderByDescending(x => x.ScopeType == EventPackageScopeType.Occurrence)
                .ThenByDescending(x => x.Version).FirstOrDefaultAsync(ct)
            : await PackageQuery(asNoTracking: true)
                .Where(x => x.EventId == eventId && x.ScopeType == EventPackageScopeType.Event && x.ScopeId == null)
                .OrderByDescending(x => x.Version).FirstOrDefaultAsync(ct);
        var hasOccurrenceReview = requestedOccurrence is not null
            ? EventOccurrencePackageExceptionState.HasOpen(requestedOccurrence.ExceptionsJson)
            : (await db.EventOccurrences.AsNoTracking()
                .Where(x => x.EventId == eventId && x.Status != EventOccurrenceStatus.Cancelled)
                .Select(x => x.ExceptionsJson).ToListAsync(ct))
                .Any(json => EventOccurrencePackageExceptionState.HasOpen(json));
        EventPackage? occurrenceExecutionPackage = null;
        if (requestedOccurrence?.ExecutionPackageId is Guid executionPackageId)
            occurrenceExecutionPackage = await PackageQuery(asNoTracking: true)
                .FirstOrDefaultAsync(x => x.Id == executionPackageId && x.EventId == eventId, ct);
        return AppResult<EventLifecycleDto>.Success(ToLifecycleDto(
            groupEvent, now, candidate, policy?.EnforcementMode,
            hasOccurrenceReview ? ["event.execute.occurrenceReviewRequired"] : null,
            occurrenceId, requestedOccurrence, occurrenceExecutionPackage));
    }

    public async Task<AppResult<EventPackageDto>> RevokeDecisionAsync(Guid eventId, Guid packageId, Guid decisionId,
        Guid memberId, RevokeEventPackageDecisionRequest request, string? ifMatch, string? idempotencyKey, CancellationToken ct)
    {
        var access = await LoadViewableEvent(eventId, memberId, ct);
        if (!access.IsSuccess) return Failure<EventPackageDto, GroupEvent>(access);
        if (string.IsNullOrWhiteSpace(request.Reason.En) || string.IsNullOrWhiteSpace(request.Reason.Zh))
            return AppResult<EventPackageDto>.Validation("A bilingual revocation reason is required.");
        var keyError = ValidateIdempotencyKey(idempotencyKey);
        if (keyError is not null) return AppResult<EventPackageDto>.Validation(keyError);
        var requestHash = EventPackageCanonicalizer.HashCanonical(new { eventId, packageId, decisionId, memberId, request });
        var replay = await ReplayAsync(RevokeOperation, packageId, idempotencyKey!, requestHash, ct);
        if (replay is not null) return replay;

        await using var transaction = await db.BeginSerializableTransactionAsync(ct);
        var package = await PackageQuery().FirstOrDefaultAsync(x => x.Id == packageId && x.EventId == eventId, ct);
        if (package is null) return AppResult<EventPackageDto>.NotFound("Event Package not found.");
        if (!Matches(ifMatch, ETag(package))) return AppResult<EventPackageDto>.PreconditionFailed("The Event Package changed; reload before revoking approval.");
        if (package.Status is not (EventPackageStatus.Approved or EventPackageStatus.ApprovedWithConditions) ||
            package.ApprovalValidityStatus != EventPackageApprovalValidity.Active)
            return AppResult<EventPackageDto>.Conflict("Only an active approved Package decision can be revoked.");
        var target = package.Decisions.FirstOrDefault(x => x.Id == decisionId &&
            x.DecisionType is EventPackageDecisionType.Approve or EventPackageDecisionType.ApproveWithConditions);
        if (target is null) return AppResult<EventPackageDto>.Validation("The target approval decision does not belong to this Package.");
        if (package.Decisions.Any(x => x.DecisionType == EventPackageDecisionType.Revoke && x.RevokedByDecisionId == decisionId))
            return AppResult<EventPackageDto>.Conflict("The approval decision has already been revoked.");
        var authority = await ResolveDecisionAuthorityAsync(access.Value!, package, memberId, ct);
        if (!authority.Allowed) return AppResult<EventPackageDto>.Forbidden(authority.DenialReason!);

        var now = DateTime.UtcNow;
        var revocation = new EventPackageDecision
        {
            Id = Guid.NewGuid(), EventPackageId = package.Id, DecisionType = EventPackageDecisionType.Revoke,
            ActorMemberId = memberId, ReasonEn = request.Reason.En.Trim(), ReasonZh = request.Reason.Zh.Trim(),
            DecidedUtc = now, EffectiveUtc = now, RevokedByDecisionId = target.Id, RequestHash = requestHash,
            DecisionAuthoritySnapshotJson = EventPackageCanonicalizer.Serialize(new
            {
                package.GovernanceTier, authority.AuthorityCode, authority.AuthorityGroupId,
                revokesDecisionId = target.Id, package.GovernancePolicyVersion
            })
        };
        db.EventPackageDecisions.Add(revocation);
        var minimumApproverCount = ReadMinimumApproverCount(target.DecisionAuthoritySnapshotJson) ?? 1;
        var remainingApprovalCount = package.Decisions.Count(x =>
            x.Id != target.Id && x.DecisionType is EventPackageDecisionType.Approve or EventPackageDecisionType.ApproveWithConditions &&
            x.InvalidatedReasonCode == null && (!x.ExpiresUtc.HasValue || x.ExpiresUtc > now) &&
            !package.Decisions.Any(existingRevocation => existingRevocation.DecisionType == EventPackageDecisionType.Revoke &&
                existingRevocation.RevokedByDecisionId == x.Id));
        package.ApprovalValidityStatus = remainingApprovalCount >= minimumApproverCount
            ? EventPackageApprovalValidity.Active : EventPackageApprovalValidity.Revoked;
        package.ConcurrencyToken = Guid.NewGuid();
        AddAudit("event.package.decision.revoked", access.Value!, memberId, package, now,
            new { validity = EventPackageApprovalValidity.Active, decisionId },
            new { validity = package.ApprovalValidityStatus, revocationDecisionId = revocation.Id,
                minimumApproverCount, remainingApprovalCount });
        AddIdempotency(RevokeOperation, packageId, idempotencyKey!, requestHash, packageId, now);
        AddNotifications(new[] { access.Value!.AccountableOwnerMemberId, package.SubmittedByMemberId,
                (Guid?)package.GeneratedByMemberId }.Where(x => x.HasValue).Select(x => x!.Value),
            memberId, access.Value, package, "event.package.decision.revoked", now,
            new { decisionId, revocationId = revocation.Id, package.ApprovalValidityStatus });
        var saved = await SavePackageAsync(package, transaction, ct);
        if (saved.IsSuccess && cacheInvalidation is not null) await cacheInvalidation.RemoveGroupEventsAsync(access.Value!.GroupId, ct);
        return saved;
    }

    public Task<AppResult<EventPackageConditionResultDto>> SatisfyConditionAsync(Guid eventId, Guid packageId,
        Guid conditionId, Guid memberId, SatisfyEventPackageConditionRequest request, string? ifMatch,
        string? idempotencyKey, CancellationToken ct)
        => MutateConditionAsync(eventId, packageId, conditionId, memberId, request, null, ifMatch, idempotencyKey, ct);

    public Task<AppResult<EventPackageConditionResultDto>> VerifyConditionAsync(Guid eventId, Guid packageId,
        Guid conditionId, Guid memberId, VerifyEventPackageConditionRequest request, string? ifMatch,
        string? idempotencyKey, CancellationToken ct)
        => MutateConditionAsync(eventId, packageId, conditionId, memberId, null, request, ifMatch, idempotencyKey, ct);

    public async Task<AppResult<EventPackageConditionResultDto>> WaiveConditionAsync(Guid eventId, Guid packageId,
        Guid conditionId, Guid memberId, WaiveEventPackageConditionRequest request, string? ifMatch,
        string? idempotencyKey, CancellationToken ct)
    {
        var access = await LoadViewableEvent(eventId, memberId, ct);
        if (!access.IsSuccess) return Failure<EventPackageConditionResultDto, GroupEvent>(access);
        if (string.IsNullOrWhiteSpace(request.Reason.En) || string.IsNullOrWhiteSpace(request.Reason.Zh))
            return AppResult<EventPackageConditionResultDto>.Validation("A bilingual condition-waiver reason is required.");
        var keyError = ValidateIdempotencyKey(idempotencyKey);
        if (keyError is not null) return AppResult<EventPackageConditionResultDto>.Validation(keyError);
        var requestHash = EventPackageCanonicalizer.HashCanonical(new { eventId, packageId, conditionId, memberId, request });
        var replay = await ReplayConditionAsync(WaiveConditionOperation, eventId, packageId, conditionId,
            idempotencyKey!, requestHash, ct);
        if (replay is not null) return replay;

        await using var transaction = await db.BeginSerializableTransactionAsync(ct);
        var package = await PackageQuery().FirstOrDefaultAsync(x => x.Id == packageId && x.EventId == eventId, ct);
        if (package is null) return AppResult<EventPackageConditionResultDto>.NotFound("Event Package not found.");
        var condition = package.Conditions.FirstOrDefault(x => x.Id == conditionId);
        if (condition is null) return AppResult<EventPackageConditionResultDto>.NotFound("Event Package condition not found.");
        if (!Matches(ifMatch, ConditionETag(condition)))
            return AppResult<EventPackageConditionResultDto>.PreconditionFailed("The condition changed; reload before waiving it.");
        if (package.Status != EventPackageStatus.ApprovedWithConditions || package.ApprovalValidityStatus != EventPackageApprovalValidity.Active)
            return AppResult<EventPackageConditionResultDto>.Conflict("Only a condition on an active conditionally approved Package can be waived.");
        if (condition.Status is EventPackageConditionStatus.Verified or EventPackageConditionStatus.Waived)
            return AppResult<EventPackageConditionResultDto>.Conflict("This condition is already resolved.");
        var policy = await db.EventPackageGovernancePolicyVersions.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == package.GovernancePolicyVersionId, ct);
        if (policy is null || !ReadConditionWaiverAllowed(policy.RulesJson))
            return AppResult<EventPackageConditionResultDto>.Conflict("event.package.condition.waiverNotAllowed");
        if (condition.SatisfiedByMemberId == memberId || condition.VerifiedByMemberId == memberId ||
            await db.EventRoleAssignments.AsNoTracking().AnyAsync(x => x.EventId == eventId && x.MemberId == memberId &&
                x.RoleRequirementKey == condition.OwnerRoleRequirementKey && x.Status == EventRoleAssignmentStatus.Accepted && x.EndedUtc == null, ct))
            return AppResult<EventPackageConditionResultDto>.Forbidden("The condition owner or evidence actor cannot waive the same condition.");
        var authority = await ResolveDecisionAuthorityAsync(access.Value!, package, memberId, ct);
        if (!authority.Allowed) return AppResult<EventPackageConditionResultDto>.Forbidden(authority.DenialReason!);

        var now = DateTime.UtcNow;
        var approvalExpiry = package.Decisions.Where(x => x.DecisionType is EventPackageDecisionType.Approve or EventPackageDecisionType.ApproveWithConditions)
            .Select(x => x.ExpiresUtc).Where(x => x.HasValue).Min();
        var waiver = new EventPackageDecision
        {
            Id = Guid.NewGuid(), EventPackageId = package.Id, DecisionType = EventPackageDecisionType.ConditionWaiver,
            ActorMemberId = memberId, ReasonEn = request.Reason.En.Trim(), ReasonZh = request.Reason.Zh.Trim(),
            DecidedUtc = now, EffectiveUtc = now, ExpiresUtc = approvalExpiry, RequestHash = requestHash,
            DecisionAuthoritySnapshotJson = EventPackageCanonicalizer.Serialize(new
            {
                decisionPurpose = "conditionWaiver", conditionId, package.GovernanceTier,
                authority.AuthorityCode, authority.AuthorityGroupId, package.GovernancePolicyVersion,
                independentFromConditionOwner = true
            })
        };
        db.EventPackageDecisions.Add(waiver);
        var previousConditionStatus = condition.Status;
        condition.Status = EventPackageConditionStatus.Waived;
        condition.WaivedByDecisionId = waiver.Id;
        condition.WaivedByDecision = waiver;
        condition.ConcurrencyToken = Guid.NewGuid();
        await SyncConditionReadinessTaskAsync(condition, memberId, now, ct);
        AddNotifications(await ResolveConditionNotificationRecipientsAsync(access.Value!, package, condition, ct),
            memberId, access.Value!, package, "event.package.condition.waived", now,
            new { conditionId, condition.AppliesToGate, condition.Status, waiverDecisionId = waiver.Id });
        AddAudit(WaiveConditionOperation, access.Value!, memberId, package, now,
            new { conditionId, status = previousConditionStatus, condition.ExpiredUtc },
            new { conditionId, status = EventPackageConditionStatus.Waived, waiverDecisionId = waiver.Id, reason = request.Reason });
        AddIdempotency(WaiveConditionOperation, conditionId, idempotencyKey!, requestHash, conditionId, now);
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException) { return AppResult<EventPackageConditionResultDto>.Conflict("event.package.condition.concurrentChange"); }
        catch (DbUpdateException) { return AppResult<EventPackageConditionResultDto>.Conflict("The condition waiver conflicted with another request."); }
        if (transaction is not null) await transaction.CommitAsync(ct);
        if (cacheInvalidation is not null) await cacheInvalidation.RemoveGroupEventsAsync(access.Value!.GroupId, ct);
        var lifecycleEvent = await LifecycleEventQuery(asNoTracking: true).FirstAsync(x => x.Id == eventId, ct);
        return AppResult<EventPackageConditionResultDto>.Success(new(ToConditionDto(condition), ToLifecycleDto(lifecycleEvent, DateTime.UtcNow)));
    }

    private async Task<AppResult<EventPackageConditionResultDto>> MutateConditionAsync(Guid eventId, Guid packageId,
        Guid conditionId, Guid memberId, SatisfyEventPackageConditionRequest? satisfy,
        VerifyEventPackageConditionRequest? verify, string? ifMatch, string? idempotencyKey, CancellationToken ct)
    {
        var access = await LoadViewableEvent(eventId, memberId, ct);
        if (!access.IsSuccess) return Failure<EventPackageConditionResultDto, GroupEvent>(access);
        var operation = satisfy is not null ? SatisfyConditionOperation : VerifyConditionOperation;
        var keyError = ValidateIdempotencyKey(idempotencyKey);
        if (keyError is not null) return AppResult<EventPackageConditionResultDto>.Validation(keyError);
        if (satisfy is not null && (string.IsNullOrWhiteSpace(satisfy.EvidenceReference) || satisfy.EvidenceReference.Trim().Length > 1000))
            return AppResult<EventPackageConditionResultDto>.Validation("A condition evidence reference of at most 1000 characters is required.");
        if (verify is not null && (string.IsNullOrWhiteSpace(verify.Reason.En) || string.IsNullOrWhiteSpace(verify.Reason.Zh)))
            return AppResult<EventPackageConditionResultDto>.Validation("A bilingual verification reason is required.");
        var requestHash = EventPackageCanonicalizer.HashCanonical(new { eventId, packageId, conditionId, memberId, satisfy, verify });
        var replay = await ReplayConditionAsync(operation, eventId, packageId, conditionId, idempotencyKey!, requestHash, ct);
        if (replay is not null) return replay;

        await using var transaction = await db.BeginSerializableTransactionAsync(ct);
        var package = await PackageQuery().FirstOrDefaultAsync(x => x.Id == packageId && x.EventId == eventId, ct);
        if (package is null) return AppResult<EventPackageConditionResultDto>.NotFound("Event Package not found.");
        var condition = package.Conditions.FirstOrDefault(x => x.Id == conditionId);
        if (condition is null) return AppResult<EventPackageConditionResultDto>.NotFound("Event Package condition not found.");
        if (!Matches(ifMatch, ConditionETag(condition))) return AppResult<EventPackageConditionResultDto>.PreconditionFailed("The condition changed; reload before updating it.");
        if (package.Status != EventPackageStatus.ApprovedWithConditions || package.ApprovalValidityStatus != EventPackageApprovalValidity.Active)
            return AppResult<EventPackageConditionResultDto>.Conflict("Only a condition on an active conditionally approved Package can be updated.");
        var now = DateTime.UtcNow;
        if (condition.DueUtc <= now) return AppResult<EventPackageConditionResultDto>.Conflict("event.package.condition.expired");

        if (satisfy is not null)
        {
            var ownsRole = await db.EventRoleAssignments.AsNoTracking().AnyAsync(x => x.EventId == eventId &&
                x.MemberId == memberId && x.RoleRequirementKey == condition.OwnerRoleRequirementKey &&
                x.Status == EventRoleAssignmentStatus.Accepted && x.EndedUtc == null, ct);
            if (!ownsRole) return AppResult<EventPackageConditionResultDto>.Forbidden("The accepted condition-owner role is required to submit evidence.");
            if (condition.Status is not (EventPackageConditionStatus.Open or EventPackageConditionStatus.Rejected))
                return AppResult<EventPackageConditionResultDto>.Conflict("This condition is not accepting evidence.");
            condition.EvidenceReference = satisfy.EvidenceReference.Trim();
            condition.EvidenceReferenceHash = EventPackageCanonicalizer.HashCanonical(condition.EvidenceReference);
            condition.EvidenceExpiresUtc = (AsUtc(access.Value!.EndDate) > now
                ? AsUtc(access.Value.EndDate)
                : now).AddDays(ConditionEvidenceRetentionDaysAfterEvent);
            condition.EvidenceUnavailableUtc = null;
            condition.SatisfiedByMemberId = memberId;
            condition.SatisfiedUtc = now;
            condition.Status = EventPackageConditionStatus.EvidenceSubmitted;
        }
        else
        {
            if (condition.Status != EventPackageConditionStatus.EvidenceSubmitted)
                return AppResult<EventPackageConditionResultDto>.Conflict("Condition evidence must be submitted before verification.");
            if (package.GovernanceTier != EventGovernanceTier.Light && condition.SatisfiedByMemberId == memberId)
                return AppResult<EventPackageConditionResultDto>.Forbidden("The evidence submitter cannot verify the same condition.");
            var authority = await ResolveDecisionAuthorityAsync(access.Value!, package, memberId, ct);
            if (!authority.Allowed) return AppResult<EventPackageConditionResultDto>.Forbidden(authority.DenialReason!);
            condition.VerifiedByMemberId = memberId;
            condition.VerifiedUtc = now;
            condition.Status = verify!.Verified ? EventPackageConditionStatus.Verified : EventPackageConditionStatus.Rejected;
        }
        condition.ConcurrencyToken = Guid.NewGuid();
        await SyncConditionReadinessTaskAsync(condition, memberId, now, ct);
        var conditionAction = satisfy is not null
            ? "event.package.condition.evidenceSubmitted"
            : verify!.Verified ? "event.package.condition.verified" : "event.package.condition.rejected";
        AddNotifications(await ResolveConditionNotificationRecipientsAsync(access.Value!, package, condition, ct),
            memberId, access.Value!, package, conditionAction, now,
            new { conditionId, condition.AppliesToGate, condition.Status, nextAction = ConditionNextAction(condition.Status) });
        AddAudit(operation, access.Value!, memberId, package, now,
            new { conditionId, status = satisfy is not null ? EventPackageConditionStatus.Open : EventPackageConditionStatus.EvidenceSubmitted },
            new { conditionId, condition.Status, verificationReason = verify?.Reason });
        AddIdempotency(operation, conditionId, idempotencyKey!, requestHash, conditionId, now);
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException) { return AppResult<EventPackageConditionResultDto>.Conflict("event.package.condition.concurrentChange"); }
        catch (DbUpdateException) { return AppResult<EventPackageConditionResultDto>.Conflict("The condition operation conflicted with another request."); }
        if (transaction is not null) await transaction.CommitAsync(ct);
        if (cacheInvalidation is not null) await cacheInvalidation.RemoveGroupEventsAsync(access.Value!.GroupId, ct);
        var lifecycleEvent = await LifecycleEventQuery(asNoTracking: true).FirstAsync(x => x.Id == eventId, ct);
        return AppResult<EventPackageConditionResultDto>.Success(new(ToConditionDto(condition), ToLifecycleDto(lifecycleEvent, DateTime.UtcNow)));
    }

    public async Task<AppResult<EventLifecycleDto>> PublishAsync(Guid eventId, Guid memberId,
        PublishEventRequest request, string? idempotencyKey, CancellationToken ct)
    {
        var access = await LoadViewableEvent(eventId, memberId, ct);
        if (!access.IsSuccess) return Failure<EventLifecycleDto, GroupEvent>(access);
        if (!await EventCompositionPersistence.CanManageEventAsync(db, authorization, access.Value!, memberId, ct))
            return AppResult<EventLifecycleDto>.Forbidden("The accountable owner or owning-group leadership is required to publish this Event.");
        var keyError = ValidateIdempotencyKey(idempotencyKey);
        if (keyError is not null) return AppResult<EventLifecycleDto>.Validation(keyError);
        if (string.IsNullOrWhiteSpace(request.EventETag))
            return AppResult<EventLifecycleDto>.Validation("The current Event lifecycle ETag is required.");
        var requestHash = EventPackageCanonicalizer.HashCanonical(new { eventId, memberId, request });
        var replay = await ReplayLifecycleAsync(PublishOperation, eventId, idempotencyKey!, requestHash, ct);
        if (replay is not null) return replay;

        await using var transaction = await db.BeginSerializableTransactionAsync(ct);
        var groupEvent = await LifecycleEventQuery().FirstOrDefaultAsync(x => x.Id == eventId, ct);
        if (groupEvent is null) return AppResult<EventLifecycleDto>.NotFound("Event not found.");
        if (!await EventCompositionPersistence.CanManageEventAsync(db, authorization, groupEvent, memberId, ct))
            return AppResult<EventLifecycleDto>.Forbidden("The accountable owner or owning-group leadership is required to publish this Event.");
        if (!Matches(request.EventETag, LifecycleETag(groupEvent)))
            return AppResult<EventLifecycleDto>.PreconditionFailed("The Event lifecycle changed; reload before publishing.");
        if (groupEvent.RamAssessment?.Status != EventRamStatus.Approved)
            return AppResult<EventLifecycleDto>.Conflict("event.publish.ramNotApproved");
        if (groupEvent.GovernanceMode == EventGovernanceMode.ChurchSponsored &&
            groupEvent.SponsorshipStatus != EventSponsorshipStatus.Approved)
            return AppResult<EventLifecycleDto>.Conflict("event.publish.sponsorshipNotApproved");

        var now = DateTime.UtcNow;
        var policy = await db.EventPackageGovernancePolicyVersions.AsNoTracking()
            .Where(x => x.IsPublished && x.EffectiveFromUtc <= now && (!x.RetiredUtc.HasValue || x.RetiredUtc > now) &&
                (x.OrganisationId == groupEvent.GroupId || x.OrganisationId == null))
            .OrderByDescending(x => x.OrganisationId == groupEvent.GroupId).ThenByDescending(x => x.EffectiveFromUtc)
            .FirstOrDefaultAsync(ct);
        var mode = policy?.EnforcementMode ?? EventPackageEnforcementMode.Off;
        EventPackage? package = null;
        var gateReasons = new List<string>();
        if (request.PackageId.HasValue)
        {
            package = await PackageQuery().FirstOrDefaultAsync(x => x.Id == request.PackageId.Value && x.EventId == eventId, ct);
            if (package is null) return AppResult<EventLifecycleDto>.Validation("The selected Event Package does not belong to this Event.");
            gateReasons.AddRange(await EvaluatePublishPackageAsync(groupEvent, package, request.PackageETag, policy, now, ct));
        }
        else gateReasons.Add("event.publish.packageMissing");
        if (mode == EventPackageEnforcementMode.Enforced && gateReasons.Count > 0)
            return AppResult<EventLifecycleDto>.Conflict(gateReasons[0]);

        var previous = new { groupEvent.PublicationStatus, groupEvent.PublishedPackageId, groupEvent.PublishedUtc };
        groupEvent.PublicationStatus = EventPublicationStatus.Published;
        groupEvent.PublishedPackageId = package?.Id;
        groupEvent.PublishedPackage = package;
        groupEvent.PublishedByMemberId = memberId;
        groupEvent.PublishedUtc = now;
        groupEvent.PublicationGateMode = mode;
        groupEvent.PublicationConcurrencyToken = Guid.NewGuid();
        AddLifecycleAudit("event.published", groupEvent, memberId, now, previous,
            new { groupEvent.PublicationStatus, groupEvent.PublishedPackageId, groupEvent.PublishedUtc, mode, dryRunReasonCodes = gateReasons });
        AddIdempotency(PublishOperation, eventId, idempotencyKey!, requestHash, eventId, now);
        var saved = await SaveLifecycleAsync(groupEvent, transaction, ct);
        if (saved.IsSuccess && cacheInvalidation is not null)
            await cacheInvalidation.RemoveGroupEventsAsync(groupEvent.GroupId, ct);
        return saved;
    }

    public async Task<AppResult<EventLifecycleDto>> OpenRegistrationAsync(Guid eventId, Guid memberId,
        OpenEventRegistrationRequest request, string? idempotencyKey, CancellationToken ct)
    {
        var access = await LoadViewableEvent(eventId, memberId, ct);
        if (!access.IsSuccess) return Failure<EventLifecycleDto, GroupEvent>(access);
        if (!await CanManageRegistrationAsync(access.Value!, memberId, allowGroupLeadership: false, ct))
            return AppResult<EventLifecycleDto>.Forbidden("The accountable owner or accepted Registration Manager is required to open registration.");
        var keyError = ValidateIdempotencyKey(idempotencyKey);
        if (keyError is not null) return AppResult<EventLifecycleDto>.Validation(keyError);
        var requestHash = EventPackageCanonicalizer.HashCanonical(new { eventId, memberId, request });
        var replay = await ReplayLifecycleAsync(OpenRegistrationOperation, eventId, idempotencyKey!, requestHash, ct);
        if (replay is not null) return replay;

        await using var transaction = await db.BeginSerializableTransactionAsync(ct);
        var groupEvent = await LifecycleEventQuery().FirstAsync(x => x.Id == eventId, ct);
        if (!Matches(request.RegistrationETag, RegistrationETag(groupEvent)))
            return AppResult<EventLifecycleDto>.PreconditionFailed("The registration lifecycle changed; reload before opening registration.");
        if (!EventLifecyclePolicy.CanOpenRegistration(groupEvent, DateTime.UtcNow, out var lifecycleError))
            return AppResult<EventLifecycleDto>.Conflict(lifecycleError);
        var now = DateTime.UtcNow;
        var policy = await CurrentPolicyAsync(groupEvent.GroupId, now, ct);
        var mode = policy?.EnforcementMode ?? EventPackageEnforcementMode.Off;
        EventPackage? package = null;
        var reasons = new List<string>();
        if (request.PackageId.HasValue)
        {
            package = await PackageQuery().FirstOrDefaultAsync(x => x.Id == request.PackageId.Value && x.EventId == eventId, ct);
            if (package is null) return AppResult<EventLifecycleDto>.Validation("The selected Event Package does not belong to this Event.");
            reasons.AddRange(await EvaluateRegistrationPackageAsync(groupEvent, package, request.PackageETag, policy, now, ct));
        }
        else reasons.Add(EventPackageGateEvaluator.Reason(EventLifecycleGate.Registration, "packageMissing"));
        if (mode == EventPackageEnforcementMode.Enforced && reasons.Count > 0)
            return AppResult<EventLifecycleDto>.Conflict(reasons[0]);

        var previous = new { groupEvent.RegistrationStatus, groupEvent.RegistrationPackageId, groupEvent.RegistrationOpenedUtc };
        groupEvent.RegistrationStatus = EventRegistrationStatus.Open;
        groupEvent.RegistrationPackageId = package?.Id;
        groupEvent.RegistrationPackage = package;
        groupEvent.RegistrationOpenedByMemberId = memberId;
        groupEvent.RegistrationOpenedUtc = now;
        groupEvent.RegistrationGateMode = mode;
        groupEvent.RegistrationConcurrencyToken = Guid.NewGuid();
        AddLifecycleAudit("event.registration.opened", groupEvent, memberId, now, previous,
            new { groupEvent.RegistrationStatus, groupEvent.RegistrationPackageId, mode, dryRunReasonCodes = reasons });
        AddIdempotency(OpenRegistrationOperation, eventId, idempotencyKey!, requestHash, eventId, now);
        var saved = await SaveLifecycleAsync(groupEvent, transaction, ct);
        if (saved.IsSuccess && cacheInvalidation is not null)
        {
            await cacheInvalidation.RemoveGroupEventsAsync(groupEvent.GroupId, ct);
            await cacheInvalidation.RemoveEventEnrollmentsAsync(eventId, ct);
        }
        return saved;
    }

    public async Task<AppResult<EventLifecycleDto>> CloseRegistrationAsync(Guid eventId, Guid memberId,
        CloseEventRegistrationRequest request, string? idempotencyKey, CancellationToken ct)
    {
        var access = await LoadViewableEvent(eventId, memberId, ct);
        if (!access.IsSuccess) return Failure<EventLifecycleDto, GroupEvent>(access);
        if (!await CanManageRegistrationAsync(access.Value!, memberId, allowGroupLeadership: true, ct))
            return AppResult<EventLifecycleDto>.Forbidden("The accountable owner, Registration Manager, or owning-group leadership is required to close registration.");
        if (string.IsNullOrWhiteSpace(request.Reason.En) || string.IsNullOrWhiteSpace(request.Reason.Zh))
            return AppResult<EventLifecycleDto>.Validation("A bilingual registration-close reason is required.");
        var keyError = ValidateIdempotencyKey(idempotencyKey);
        if (keyError is not null) return AppResult<EventLifecycleDto>.Validation(keyError);
        var requestHash = EventPackageCanonicalizer.HashCanonical(new { eventId, memberId, request });
        var replay = await ReplayLifecycleAsync(CloseRegistrationOperation, eventId, idempotencyKey!, requestHash, ct);
        if (replay is not null) return replay;

        await using var transaction = await db.BeginSerializableTransactionAsync(ct);
        var groupEvent = await LifecycleEventQuery().FirstAsync(x => x.Id == eventId, ct);
        if (!Matches(request.RegistrationETag, RegistrationETag(groupEvent)))
            return AppResult<EventLifecycleDto>.PreconditionFailed("The registration lifecycle changed; reload before closing registration.");
        if (groupEvent.RegistrationStatus == EventRegistrationStatus.Closed)
            return AppResult<EventLifecycleDto>.Conflict("Registration is already closed.");
        var now = DateTime.UtcNow;
        var previous = new { groupEvent.RegistrationStatus, groupEvent.RegistrationPackageId };
        groupEvent.RegistrationStatus = EventRegistrationStatus.Closed;
        groupEvent.RegistrationConcurrencyToken = Guid.NewGuid();
        AddLifecycleAudit("event.registration.closed", groupEvent, memberId, now, previous,
            new { groupEvent.RegistrationStatus, reason = request.Reason });
        AddIdempotency(CloseRegistrationOperation, eventId, idempotencyKey!, requestHash, eventId, now);
        var saved = await SaveLifecycleAsync(groupEvent, transaction, ct);
        if (saved.IsSuccess && cacheInvalidation is not null)
        {
            await cacheInvalidation.RemoveGroupEventsAsync(groupEvent.GroupId, ct);
            await cacheInvalidation.RemoveEventEnrollmentsAsync(eventId, ct);
        }
        return saved;
    }

    public async Task<AppResult<EventLifecycleDto>> ConfirmExecutionAsync(Guid eventId, Guid memberId,
        ConfirmEventExecutionRequest request, string? idempotencyKey, CancellationToken ct)
    {
        var access = await LoadViewableEvent(eventId, memberId, ct);
        if (!access.IsSuccess) return Failure<EventLifecycleDto, GroupEvent>(access);
        if (!await CanConfirmExecutionAsync(access.Value!, memberId, ct))
            return AppResult<EventLifecycleDto>.Forbidden("The accountable owner or accepted Event Lead is required to confirm execution.");
        var keyError = ValidateIdempotencyKey(idempotencyKey);
        if (keyError is not null) return AppResult<EventLifecycleDto>.Validation(keyError);
        var requestHash = EventPackageCanonicalizer.HashCanonical(new { eventId, memberId, request });
        var replay = await ReplayLifecycleAsync(ConfirmExecutionOperation, eventId, idempotencyKey!, requestHash, ct,
            request.ScopeType == EventPackageScopeType.Occurrence ? request.ScopeId : null);
        if (replay is not null) return replay;

        await using var transaction = await db.BeginSerializableTransactionAsync(ct);
        var groupEvent = await LifecycleEventQuery().FirstAsync(x => x.Id == eventId, ct);
        EventOccurrence? executionOccurrence = null;
        if (request.ScopeType == EventPackageScopeType.Occurrence)
        {
            if (!request.ScopeId.HasValue) return AppResult<EventLifecycleDto>.Validation("Occurrence execution requires scopeId.");
            executionOccurrence = await db.EventOccurrences.FirstOrDefaultAsync(x =>
                x.Id == request.ScopeId.Value && x.EventId == eventId && x.Status != EventOccurrenceStatus.Cancelled, ct);
            if (executionOccurrence is null) return AppResult<EventLifecycleDto>.Validation("The execution occurrence is unavailable.");
        }
        else if (request.ScopeId.HasValue)
        {
            return AppResult<EventLifecycleDto>.Validation("Event execution must not specify scopeId.");
        }
        var expectedExecutionETag = executionOccurrence is null
            ? ExecutionETag(groupEvent)
            : ExecutionETag(executionOccurrence);
        if (!Matches(request.ExecutionETag, expectedExecutionETag))
            return AppResult<EventLifecycleDto>.PreconditionFailed("The execution lifecycle changed; reload before confirming.");
        var package = await PackageQuery().FirstOrDefaultAsync(x => x.Id == request.PackageId && x.EventId == eventId, ct);
        if (package is null) return AppResult<EventLifecycleDto>.Validation("The selected Event Package does not belong to this Event.");
        if (!PackageCoversExecutionScope(package, request.ScopeType, request.ScopeId))
            return AppResult<EventLifecycleDto>.Validation("The selected Event Package does not cover the requested execution scope.");
        if (!Matches(request.PackageETag, ETag(package)))
            return AppResult<EventLifecycleDto>.PreconditionFailed("The Event Package changed; reload before confirming execution.");

        var now = DateTime.UtcNow;
        var policy = await CurrentPolicyAsync(groupEvent.GroupId, now, ct);
        if (policy is null) return AppResult<EventLifecycleDto>.Conflict("A current Event Package governance policy is required for execution confirmation.");
        PolicyRules rules;
        try { rules = JsonSerializer.Deserialize<PolicyRules>(policy.RulesJson, JsonOptions)!; }
        catch (JsonException) { return AppResult<EventLifecycleDto>.Conflict("The current Event Package governance policy is invalid."); }
        if (rules is null || rules.PreEventConfirmationWindowHours <= 0)
            return AppResult<EventLifecycleDto>.Conflict("The policy does not define a valid pre-event confirmation window.");
        var scopeStart = AsUtc(groupEvent.StartDate);
        var scopeEnd = AsUtc(groupEvent.EndDate);
        if (executionOccurrence is not null)
        {
            scopeStart = executionOccurrence.StartUtc;
            scopeEnd = executionOccurrence.EndUtc;
        }
        if (now < scopeStart.AddHours(-rules.PreEventConfirmationWindowHours) || now > scopeEnd)
            return AppResult<EventLifecycleDto>.Conflict("event.execute.outsideConfirmationWindow");

        var reasons = EventPackageGateEvaluator.Evaluate(EventLifecycleGate.Execute,
            policy.EnforcementMode, package, now).ReasonCodes.ToList();
        if (package.GovernancePolicyVersionId != policy.Id) reasons.Add("event.execute.policyChanged");
        if (request.ScopeType == EventPackageScopeType.Event)
        {
            var occurrenceExceptionJson = await db.EventOccurrences.AsNoTracking()
                .Where(x => x.EventId == eventId && x.Status != EventOccurrenceStatus.Cancelled)
                .Select(x => x.ExceptionsJson).ToListAsync(ct);
            if (occurrenceExceptionJson.Any(json => EventOccurrencePackageExceptionState.HasOpen(json)))
                reasons.Add("event.execute.occurrenceReviewRequired");
        }
        else if (executionOccurrence is not null &&
            EventOccurrencePackageExceptionState.HasOpen(executionOccurrence.ExceptionsJson))
        {
            reasons.Add("event.execute.occurrenceReviewRequired");
        }
        if (reasons.Count == 0)
        {
            if (!await IsPackageFreshForExecutionScopeAsync(package, request.ScopeType, request.ScopeId, ct))
                reasons.Add("event.execute.packageSourceChanged");
        }
        if (policy.EnforcementMode == EventPackageEnforcementMode.Enforced && reasons.Count > 0)
            return AppResult<EventLifecycleDto>.Conflict(reasons[0]);

        object previous;
        if (executionOccurrence is null)
        {
            previous = new { scopeType = "event", groupEvent.ExecutionStatus, groupEvent.ExecutionPackageId, groupEvent.ExecutionConfirmedUtc };
            groupEvent.ExecutionStatus = EventExecutionStatus.Confirmed;
            groupEvent.ExecutionPackageId = package.Id;
            groupEvent.ExecutionPackage = package;
            groupEvent.ExecutionConfirmedByMemberId = memberId;
            groupEvent.ExecutionConfirmedUtc = now;
            groupEvent.ExecutionGateMode = policy.EnforcementMode;
            groupEvent.ExecutionConcurrencyToken = Guid.NewGuid();
        }
        else
        {
            previous = new { scopeType = "occurrence", scopeId = executionOccurrence.Id, executionOccurrence.ExecutionStatus,
                executionOccurrence.ExecutionPackageId, executionOccurrence.ExecutionConfirmedUtc };
            executionOccurrence.ExecutionStatus = EventExecutionStatus.Confirmed;
            executionOccurrence.ExecutionPackageId = package.Id;
            executionOccurrence.ExecutionPackage = package;
            executionOccurrence.ExecutionConfirmedByMemberId = memberId;
            executionOccurrence.ExecutionConfirmedUtc = now;
            executionOccurrence.ExecutionGateMode = policy.EnforcementMode;
            executionOccurrence.ExecutionConcurrencyToken = Guid.NewGuid();
        }
        AddLifecycleAudit("event.execution.confirmed", groupEvent, memberId, now, previous,
            new { request.ScopeType, request.ScopeId, executionStatus = executionOccurrence?.ExecutionStatus ?? groupEvent.ExecutionStatus,
                executionPackageId = executionOccurrence?.ExecutionPackageId ?? groupEvent.ExecutionPackageId,
                policy.EnforcementMode, dryRunReasonCodes = reasons });
        AddIdempotency(ConfirmExecutionOperation, eventId, idempotencyKey!, requestHash, eventId, now);
        var saved = await SaveLifecycleAsync(groupEvent, transaction, ct, executionOccurrence, package, policy.EnforcementMode);
        if (saved.IsSuccess && cacheInvalidation is not null) await cacheInvalidation.RemoveGroupEventsAsync(groupEvent.GroupId, ct);
        return saved;
    }

    private async Task<bool> IsPackageFreshForExecutionScopeAsync(
        EventPackage package, EventPackageScopeType requestedScopeType, Guid? requestedScopeId, CancellationToken ct)
    {
        var captureScope = package.ScopeType == EventPackageScopeType.Event &&
            requestedScopeType == EventPackageScopeType.Occurrence
                ? new GenerateEventPackageRequest(EventPackageScopeType.Occurrence, requestedScopeId, package.PackageSchemaVersion)
                : new GenerateEventPackageRequest(package.ScopeType, package.ScopeId, package.PackageSchemaVersion);
        var capture = await CaptureAsync(package.EventId, captureScope, ct);
        if (!capture.IsSuccess || capture.Value!.Plan.PlanVersion != package.EventPlanVersion ||
            capture.Value.Policy.Id != package.GovernancePolicyVersionId)
            return false;
        if (captureScope.ScopeType == package.ScopeType)
            return string.Equals(capture.Value.SourceVectorHash, package.SourceVectorHash, StringComparison.Ordinal);

        return capture.Value.Sources.All(current => package.SourceReferences.Any(frozen =>
            frozen.ModuleCode == current.ModuleCode && frozen.SubjectType == current.SubjectType &&
            frozen.SubjectId == current.SubjectId && frozen.SubjectVersion == current.SubjectVersion));
    }

    private static bool PackageCoversExecutionScope(
        EventPackage package, EventPackageScopeType requestedScopeType, Guid? requestedScopeId)
    {
        if (requestedScopeType == EventPackageScopeType.Event)
            return package.ScopeType == EventPackageScopeType.Event && !requestedScopeId.HasValue;
        if (!requestedScopeId.HasValue) return false;
        if (package.ScopeType == EventPackageScopeType.Occurrence)
            return package.ScopeId == requestedScopeId;
        try
        {
            var covered = JsonSerializer.Deserialize<Guid[]>(package.CoveredOccurrenceIdsJson, JsonOptions) ?? [];
            return covered.Contains(requestedScopeId.Value);
        }
        catch (JsonException)
        {
            return false;
        }
    }

    public async Task<AppResult<EventLifecycleDto>> UnpublishAsync(Guid eventId, Guid memberId,
        UnpublishEventRequest request, string? idempotencyKey, CancellationToken ct)
    {
        var access = await LoadViewableEvent(eventId, memberId, ct);
        if (!access.IsSuccess) return Failure<EventLifecycleDto, GroupEvent>(access);
        if (!await EventCompositionPersistence.CanManageEventAsync(db, authorization, access.Value!, memberId, ct))
            return AppResult<EventLifecycleDto>.Forbidden("The accountable owner or owning-group leadership is required to unpublish this Event.");
        var keyError = ValidateIdempotencyKey(idempotencyKey);
        if (keyError is not null) return AppResult<EventLifecycleDto>.Validation(keyError);
        if (string.IsNullOrWhiteSpace(request.Reason.En) || string.IsNullOrWhiteSpace(request.Reason.Zh))
            return AppResult<EventLifecycleDto>.Validation("A bilingual unpublish reason is required.");
        if (request.Reason.En.Trim().Length > 2000 || request.Reason.Zh.Trim().Length > 2000)
            return AppResult<EventLifecycleDto>.Validation("Each unpublish reason must be at most 2000 characters.");
        var requestHash = EventPackageCanonicalizer.HashCanonical(new { eventId, memberId, request });
        var replay = await ReplayLifecycleAsync(UnpublishOperation, eventId, idempotencyKey!, requestHash, ct);
        if (replay is not null) return replay;

        await using var transaction = await db.BeginSerializableTransactionAsync(ct);
        var groupEvent = await LifecycleEventQuery().FirstOrDefaultAsync(x => x.Id == eventId, ct);
        if (groupEvent is null) return AppResult<EventLifecycleDto>.NotFound("Event not found.");
        if (!await EventCompositionPersistence.CanManageEventAsync(db, authorization, groupEvent, memberId, ct))
            return AppResult<EventLifecycleDto>.Forbidden("The accountable owner or owning-group leadership is required to unpublish this Event.");
        if (!Matches(request.EventETag, LifecycleETag(groupEvent)))
            return AppResult<EventLifecycleDto>.PreconditionFailed("The Event lifecycle changed; reload before unpublishing.");
        if (groupEvent.PublicationStatus != EventPublicationStatus.Published &&
            groupEvent.PublicationStatus != EventPublicationStatus.LegacyImplicit)
            return AppResult<EventLifecycleDto>.Conflict("The Event is not currently published.");

        var now = DateTime.UtcNow;
        var previous = new { groupEvent.PublicationStatus, groupEvent.PublishedPackageId, groupEvent.PublishedUtc };
        groupEvent.PublicationStatus = EventPublicationStatus.Unpublished;
        groupEvent.PublicationConcurrencyToken = Guid.NewGuid();
        AddLifecycleAudit("event.unpublished", groupEvent, memberId, now, previous,
            new { groupEvent.PublicationStatus, reason = request.Reason });
        AddIdempotency(UnpublishOperation, eventId, idempotencyKey!, requestHash, eventId, now);
        var saved = await SaveLifecycleAsync(groupEvent, transaction, ct);
        if (saved.IsSuccess && cacheInvalidation is not null)
            await cacheInvalidation.RemoveGroupEventsAsync(groupEvent.GroupId, ct);
        return saved;
    }

    private async Task<AppResult<PackageCapture>> CaptureAsync(Guid eventId, GenerateEventPackageRequest request, CancellationToken ct)
    {
        var groupEvent = await db.GroupEvents.AsNoTracking().Include(x => x.RamAssessment)
            .FirstOrDefaultAsync(x => x.Id == eventId, ct);
        if (groupEvent is null) return AppResult<PackageCapture>.NotFound("Event not found.");
        var planEntity = await db.EventPlanSnapshots.AsNoTracking()
            .Where(x => x.EventId == groupEvent.Id && x.IsActive).OrderByDescending(x => x.Version).FirstOrDefaultAsync(ct);
        if (planEntity is null) return AppResult<PackageCapture>.Conflict("An accepted Event Plan is required before Package generation.");
        var plan = EventCompositionPersistence.ToSnapshotDto(planEntity);
        var now = DateTime.UtcNow;
        var currentPlan = EventCompositionPersistence.RefreshReadiness(plan.Plan, groupEvent, now);
        currentPlan = await EventCompositionPersistence.ApplyOperationalReadinessAsync(
            db, currentPlan, groupEvent, now, ct);
        var policy = await db.EventPackageGovernancePolicyVersions.AsNoTracking()
            .Where(x => x.IsPublished && x.EffectiveFromUtc <= now && (!x.RetiredUtc.HasValue || x.RetiredUtc > now) &&
                (x.OrganisationId == groupEvent.GroupId || x.OrganisationId == null))
            .OrderByDescending(x => x.OrganisationId == groupEvent.GroupId).ThenByDescending(x => x.EffectiveFromUtc)
            .FirstOrDefaultAsync(ct);
        if (policy is null) return AppResult<PackageCapture>.Conflict("A current published Event Package governance policy is required.");
        PolicyRules rules;
        try { rules = JsonSerializer.Deserialize<PolicyRules>(policy.RulesJson, JsonOptions) ?? throw new JsonException(); }
        catch (JsonException) { return AppResult<PackageCapture>.Conflict("The current Event Package governance policy is invalid."); }
        if (!string.Equals(rules.SchemaVersion, "1", StringComparison.Ordinal) || rules.TierRules is null ||
            !rules.TierRules.Any(x => x.Tier == EventGovernanceTier.Light) ||
            !rules.TierRules.Any(x => x.Tier == EventGovernanceTier.Standard) ||
            !rules.TierRules.Any(x => x.Tier == EventGovernanceTier.Enhanced) ||
            rules.TierRules.Any(x => x.WhenAnyConfirmedFactCodes is null || x.WhenAnyActivityTypeCodes is null || x.WhenAnyModuleCodes is null) ||
            rules.AuthorityByTier is null || new[] { "light", "standard", "enhanced" }.Any(x =>
                !rules.AuthorityByTier.TryGetValue(x, out var authority) || authority.MinimumApproverCount is < 1 or > 5) ||
            rules.LegacyRollout?.TransitionByMode is null || rules.LegacyRollout.SafetyCriticalModuleCodes is null ||
            string.IsNullOrWhiteSpace(rules.LegacyRollout.CohortRule) || rules.PreEventConfirmationWindowHours <= 0)
            return AppResult<PackageCapture>.Conflict("The current Event Package governance policy is incomplete.");

        var scope = await ResolveScope(groupEvent, request, ct);
        if (!scope.IsSuccess) return Failure<PackageCapture, ScopeCapture>(scope);
        var selected = plan.Plan.ModuleDecisions.Where(x => x.Status is EventModuleDecisionStatus.Required or EventModuleDecisionStatus.Selected)
            .OrderBy(x => x.ModuleCode, StringComparer.Ordinal).ToArray();
        var tier = ResolveTier(plan.Plan, rules, selected);
        var legacyTransition = ResolveLegacyTransition(plan, policy.EnforcementMode, rules.LegacyRollout, selected);
        var sources = new List<SourceCapture>
        {
            new("CORE", "eventPlan", planEntity.Id, plan.ETag, null, null, "approvalEvidence", true),
            new("CORE", "event", groupEvent.Id, EventPackageCanonicalizer.HashCanonical(new
            {
                groupEvent.GroupId, groupEvent.AccountableOwnerMemberId, groupEvent.ParentEventId,
                groupEvent.EventSeriesId, groupEvent.GovernanceMode, groupEvent.SponsorshipStatus,
                groupEvent.StartDate, groupEvent.EndDate,
                eventDataHash = EventPackageCanonicalizer.HashGovernanceEventData(groupEvent.EventDataJson),
                groupEvent.PlanConcurrencyToken
            }), null, null, "churchOrGroupVisible", true),
            new("CORE", "governancePolicy", policy.Id, EventPackageCanonicalizer.HashCanonical(new
            {
                policy.Version, policy.SchemaVersion, policy.RulesJson, policy.EnforcementMode,
                policy.EffectiveFromUtc, policy.RetiredUtc, policy.IsPublished
            }), null, policy.RetiredUtc, "approvalEvidence", true)
        };
        var modules = new List<EventPackageModuleSummaryDto>();
        var blockers = new List<LocalizedTextDto>();
        foreach (var decision in selected)
        {
            var available = !UnavailableModules.Contains(decision.ModuleCode);
            string sourceVersion;
            if (OccurrenceVersionedModules.Contains(decision.ModuleCode))
            {
                var occurrenceVersions = new List<object>();
                foreach (var occurrenceId in scope.Value!.CoveredOccurrenceIds.Order())
                {
                    var occurrenceVersion = await ModuleSourceVersionAsync(
                        groupEvent.Id, decision.ModuleCode, occurrenceId, ct);
                    occurrenceVersions.Add(new { occurrenceId, sourceVersion = occurrenceVersion });
                    sources.Add(new(decision.ModuleCode, "moduleOccurrence", occurrenceId, occurrenceVersion,
                        null, null, DataClass(decision.ModuleCode), true));
                }
                sourceVersion = EventPackageCanonicalizer.HashCanonical(occurrenceVersions);
            }
            else
            {
                sourceVersion = await ModuleSourceVersionAsync(groupEvent.Id, decision.ModuleCode, null, ct);
                sources.Add(new(decision.ModuleCode, "moduleAggregate", groupEvent.Id, sourceVersion, null, null,
                    DataClass(decision.ModuleCode), true));
            }
            var moduleBlockers = currentPlan.Navigation
                .Where(x => string.Equals(x.ModuleCode, decision.ModuleCode, StringComparison.Ordinal))
                .SelectMany(x => x.Blockers)
                .Distinct()
                .ToList();
            if (!available && decision.Status == EventModuleDecisionStatus.Required)
            {
                var blocker = new LocalizedTextDto(
                    $"{decision.ModuleCode} is required but its authoritative operational source is unavailable.",
                    $"{decision.ModuleCode} 是必需模块，但其权威业务来源尚不可用。");
                moduleBlockers.Add(blocker); blockers.Add(blocker);
            }
            modules.Add(new(decision.ModuleCode, JsonNamingPolicy.CamelCase.ConvertName(decision.Status.ToString()),
                available ? "available" : "unavailable", sourceVersion, moduleBlockers.Distinct().ToArray()));
        }
        var distinctBlockers = blockers.Distinct().ToArray();
        var manifest = new EventPackageManifestDto(PackageSchemaVersion, groupEvent.Id, request.ScopeType, request.ScopeId,
            scope.Value!.CoverageMode, scope.Value.CoveredOccurrenceIds, plan.PlanVersion, policy.Version, tier, legacyTransition,
            new(groupEvent.TitleEn, groupEvent.TitleZh), AsUtc(groupEvent.StartDate), AsUtc(groupEvent.EndDate), modules, distinctBlockers)
        {
            TriggerReasons = BuildTriggerReasons(tier, policy.Version, selected),
            RequiredSpecialistDecisions = RequiredSpecialistDecisions(selected),
            Sections = BuildPackageSections(groupEvent, scope.Value.CoveredOccurrenceIds, modules),
            Warnings = modules.SelectMany(x => x.Blockers).Distinct().ToArray()
        };
        var orderedSources = sources.OrderBy(x => x.ModuleCode, StringComparer.Ordinal)
            .ThenBy(x => x.SubjectType, StringComparer.Ordinal).ThenBy(x => x.SubjectId).ThenBy(x => x.SubjectVersion, StringComparer.Ordinal).ToArray();
        var sourceHash = EventPackageCanonicalizer.HashCanonical(orderedSources.Select(x => new
        {
            x.ModuleCode, x.SubjectType, x.SubjectId, x.SubjectVersion, x.SourceDecisionId, x.ValidUntilUtc,
            x.DataClass, x.RequiredForDecision
        }).ToArray());
        return AppResult<PackageCapture>.Success(new(plan, policy, manifest, orderedSources, sourceHash));
    }

    private async Task<AppResult<ScopeCapture>> ResolveScope(GroupEvent groupEvent, GenerateEventPackageRequest request, CancellationToken ct)
    {
        if (request.ScopeType == EventPackageScopeType.Event && request.ScopeId.HasValue)
            return AppResult<ScopeCapture>.Validation("Event scope must not specify scopeId.");
        if (request.ScopeType == EventPackageScopeType.Occurrence && !request.ScopeId.HasValue)
            return AppResult<ScopeCapture>.Validation("Occurrence scope requires scopeId.");
        var occurrences = await db.EventOccurrences.AsNoTracking()
            .Where(x => x.EventId == groupEvent.Id && x.Status != EventOccurrenceStatus.Cancelled)
            .OrderBy(x => x.StartUtc).Select(x => x.Id).ToListAsync(ct);
        if (request.ScopeType == EventPackageScopeType.Occurrence)
        {
            if (!occurrences.Contains(request.ScopeId!.Value))
                return AppResult<ScopeCapture>.Validation("The occurrence does not belong to this Event or is cancelled.");
            return AppResult<ScopeCapture>.Success(new(EventPackageCoverageMode.ExplicitOccurrences, [request.ScopeId.Value]));
        }
        if (occurrences.Count == 0) return AppResult<ScopeCapture>.Conflict("At least one non-cancelled occurrence is required.");
        return AppResult<ScopeCapture>.Success(new(groupEvent.EventSeriesId.HasValue
            ? EventPackageCoverageMode.PlanBoundSeriesWindow : EventPackageCoverageMode.ExplicitOccurrences, occurrences));
    }

    private async Task<string> ModuleSourceVersionAsync(
        Guid eventId, string moduleCode, Guid? occurrenceId, CancellationToken ct)
    {
        object source = moduleCode switch
        {
            "TEAM.WORK" => new
            {
                roles = await db.EventRoleAssignments.AsNoTracking().Where(x => x.EventId == eventId)
                    .OrderBy(x => x.RoleRequirementKey).ThenBy(x => x.Id).Select(x => new { x.Id, x.RoleRequirementKey, x.ScopeType, x.ScopeId, x.Status, x.EndedUtc }).ToListAsync(ct),
                // Package-condition tasks are projections of the Package itself. Including them would
                // make a decision invalidate its own frozen source vector.
                tasks = await db.EventTasks.AsNoTracking().Where(x => x.EventId == eventId &&
                        !db.EventPackageConditions.Any(condition => condition.ReadinessTaskId == x.Id))
                    .OrderBy(x => x.Id).Select(x => new { x.Id, x.Status, x.IsRequired, x.RequiresApproval, x.DueUtc, x.CompletedUtc, x.ConcurrencyToken }).ToListAsync(ct)
            },
            "PEOPLE.REGISTRATION" => new
            {
                configurationHash = EventPackageCanonicalizer.HashGovernanceEventData(
                    await db.GroupEvents.AsNoTracking().Where(x => x.Id == eventId)
                        .Select(x => x.EventDataJson).SingleAsync(ct)),
                managers = await db.EventRoleAssignments.AsNoTracking().Where(x => x.EventId == eventId &&
                        x.RoleRequirementKey.EndsWith(":registration.manager"))
                    .OrderBy(x => x.Id).Select(x => new { x.Id, x.MemberId, x.Status, x.EndedUtc }).ToListAsync(ct)
            },
            "SERVICE.ROSTER" => await db.EventServiceSlots.AsNoTracking().Where(x => x.Occurrence.EventId == eventId &&
                    (!occurrenceId.HasValue || x.OccurrenceId == occurrenceId.Value))
                .OrderBy(x => x.Id).Select(x => new { x.Id, x.OccurrenceId, x.RequiredCount, x.UpdatedUtc,
                    accepted = x.Assignments.Count(a => a.Status == EventRosterAssignmentStatus.Confirmed && a.EndedUtc == null) }).ToListAsync(ct),
            "SAFETY.RAM" => await db.EventRamAssessments.AsNoTracking().Where(x => x.EventId == eventId)
                .Select(x => new { x.EventId, x.Status, x.SubmittedUtc, x.ApprovedUtc, x.UpdatedUtc }).ToListAsync(ct),
            "SAFEGUARDING.CHILD" => new
            {
                configuration = await db.EventSafeguardingConfigurations.AsNoTracking().Where(x => x.EventId == eventId)
                    .Select(x => new { x.Id, x.PolicyVersionId, x.ConfiguredUtc, x.ConcurrencyToken }).ToListAsync(ct),
                children = await db.EventChildRegistrations.AsNoTracking().Where(x => x.EventId == eventId)
                    .OrderBy(x => x.Id).Select(x => new { x.Id, x.IsActive, x.EndedUtc, x.ConcurrencyToken }).ToListAsync(ct),
                guardians = await db.EventChildGuardianRelationships.AsNoTracking()
                    .Where(x => x.ChildRegistration.EventId == eventId).OrderBy(x => x.Id)
                    .Select(x => new { x.Id, x.ChildRegistrationId, x.Status, x.ConfirmedUtc, x.EndedUtc, x.ConcurrencyToken }).ToListAsync(ct),
                consents = await db.EventChildConsentRecords.AsNoTracking()
                    .Where(x => x.ChildRegistration.EventId == eventId).OrderBy(x => x.Id)
                    .Select(x => new { x.Id, x.ChildRegistrationId, x.GuardianRelationshipId, x.PolicyVersionId, x.Decision, x.RecordedUtc }).ToListAsync(ct),
                collectors = await db.EventChildAuthorisedCollectors.AsNoTracking()
                    .Where(x => x.ChildRegistration.EventId == eventId).OrderBy(x => x.Id)
                    .Select(x => new { x.Id, x.ChildRegistrationId, x.IsActive, x.RevokedUtc, x.ConcurrencyToken }).ToListAsync(ct),
                eligibleWorkers = await db.EventSafeguardingWorkerEligibility.AsNoTracking().Where(x => x.EventId == eventId)
                    .OrderBy(x => x.Id).Select(x => new { x.Id, x.PolicyVersionId, x.MemberId,
                        x.RoleRequirementKey, x.EligibilityEvidenceCode, x.IsEligible, x.ConcurrencyToken }).ToListAsync(ct)
            },
            "PROGRAM.PRODUCTION" => new
            {
                sessions = await db.EventSessions.AsNoTracking().Where(x => x.Occurrence.EventId == eventId &&
                        (!occurrenceId.HasValue || x.OccurrenceId == occurrenceId.Value))
                    .OrderBy(x => x.Id).Select(x => new { x.Id, x.OccurrenceId, x.Status, x.StartUtc, x.EndUtc, x.UpdatedUtc }).ToListAsync(ct),
                items = await db.EventProgramItems.AsNoTracking().Where(x => x.Session.Occurrence.EventId == eventId &&
                        (!occurrenceId.HasValue || x.Session.OccurrenceId == occurrenceId.Value))
                    .OrderBy(x => x.Id).Select(x => new { x.Id, x.SessionId, x.SortOrder, x.StartOffsetMinutes, x.DurationMinutes, x.UpdatedUtc }).ToListAsync(ct)
            },
            "PLACE.RESOURCE" => await db.EventVenueReservations.AsNoTracking().Where(x => x.EventId == eventId &&
                    (!occurrenceId.HasValue || x.EventOccurrenceId == null || x.EventOccurrenceId == occurrenceId.Value))
                .OrderBy(x => x.Id).Select(x => new { x.Id, x.VenueId, x.EventOccurrenceId, x.StartUtc, x.EndUtc,
                    x.RequiredCapacity, x.Status, x.ConcurrencyToken, x.UpdatedUtc }).ToListAsync(ct),
            "MOVE.STAY" => new
            {
                drivers = await db.EventTravelDrivers.AsNoTracking().Where(x => x.EventId == eventId)
                    .OrderBy(x => x.Id).Select(x => new { x.Id, x.LicenceExpiresOn, x.LicenceConfirmed, x.FitToDriveConfirmed, x.IsActive, x.ConcurrencyToken }).ToListAsync(ct),
                vehicles = await db.EventTravelVehicles.AsNoTracking().Where(x => x.EventId == eventId)
                    .OrderBy(x => x.Id).Select(x => new { x.Id, x.SeatCapacity, x.RegistrationConfirmed, x.RegistrationExpiresOn, x.WofConfirmed, x.WofExpiresOn, x.IsActive, x.ConcurrencyToken }).ToListAsync(ct),
                journeys = await db.EventTravelJourneys.AsNoTracking().Where(x => x.EventId == eventId &&
                        (!occurrenceId.HasValue || x.EventOccurrenceId == occurrenceId.Value))
                    .OrderBy(x => x.Id).Select(x => new { x.Id, x.EventOccurrenceId, x.StartUtc, x.EndUtc, x.DriverId, x.VehicleId,
                        x.ManifestConfirmed, x.Status, x.ConcurrencyToken, passengerCount = x.PassengerAssignments.Count(y => y.EndedUtc == null) }).ToListAsync(ct)
            },
            "COMMS.FOLLOWUP" => await db.GroupEvents.AsNoTracking().Where(x => x.Id == eventId)
                .Select(x => new { x.Id, x.TitleEn, x.TitleZh, x.UpdatedUtc }).ToListAsync(ct),
            _ => new { moduleCode, availability = "unavailable" }
        };
        return EventPackageCanonicalizer.HashCanonical(source);
    }

    private static EventGovernanceTier ResolveTier(EventPlanProposalDto plan, PolicyRules rules, IReadOnlyList<ModuleDecisionDto> selected)
    {
        var confirmedTrue = plan.Facts.Items.Where(x => x.Certainty == EventFactCertainty.Confirmed && x.Value is { } value && value.ValueKind == JsonValueKind.True)
            .Select(x => x.Code).ToHashSet(StringComparer.Ordinal);
        var modules = selected.Select(x => x.ModuleCode).ToHashSet(StringComparer.Ordinal);
        return rules.TierRules!
            .Where(rule => rule.Tier == EventGovernanceTier.Light ||
                rule.WhenAnyConfirmedFactCodes!.Any(confirmedTrue.Contains) ||
                (!string.IsNullOrWhiteSpace(plan.ActivityTypeCode) && rule.WhenAnyActivityTypeCodes!.Contains(plan.ActivityTypeCode, StringComparer.Ordinal)) ||
                rule.WhenAnyModuleCodes!.Any(modules.Contains))
            .Select(x => x.Tier)
            .DefaultIfEmpty(EventGovernanceTier.Light)
            .Max();
    }

    private static IReadOnlyList<EventPackageReasonDto> BuildTriggerReasons(
        EventGovernanceTier tier, string policyVersion, IReadOnlyList<ModuleDecisionDto> selected)
    {
        var reasons = new List<EventPackageReasonDto>
        {
            new("event.governance.policyTier", new(
                $"Governance policy {policyVersion} resolved this Package as {tier}.",
                $"治理政策 {policyVersion} 将此审批包判定为 {tier} 等级。"))
        };
        reasons.AddRange(selected.Select(module => new EventPackageReasonDto(
            $"event.module.{module.ModuleCode.ToLowerInvariant()}.selected",
            new($"{module.ModuleCode} is included by the accepted Event Plan.",
                $"已接受的活动计划纳入了 {module.ModuleCode}。"))));
        return reasons;
    }

    private static IReadOnlyList<string> RequiredSpecialistDecisions(IReadOnlyList<ModuleDecisionDto> selected)
    {
        var modules = selected.Select(x => x.ModuleCode).ToHashSet(StringComparer.Ordinal);
        var required = new List<string>();
        if (modules.Contains("SAFETY.RAM")) required.Add("ram");
        if (modules.Contains("SAFEGUARDING.CHILD")) required.Add("safeguarding");
        if (modules.Contains("MONEY.FINANCE")) required.Add("finance");
        required.Add("sponsorshipWhenPolicyRequires");
        return required;
    }

    private static IReadOnlyList<EventPackageSectionDto> BuildPackageSections(
        GroupEvent groupEvent, IReadOnlyList<Guid> coveredOccurrenceIds,
        IReadOnlyList<EventPackageModuleSummaryDto> modules)
    {
        EventPackageSectionDto Section(string code, string en, string zh, IReadOnlyList<string> moduleCodes,
            params LocalizedTextDto[] items)
        {
            var selected = modules.Where(x => moduleCodes.Contains(x.ModuleCode, StringComparer.Ordinal)).ToArray();
            var blockers = selected.SelectMany(x => x.Blockers).Distinct().ToArray();
            if (selected.Length == 0 &&
                code is not ("overview" or "structure" or "peoplePlaceResources" or "readinessChanges"))
            {
                return new(code, new(en, zh), "notApplicable",
                    [new("Not applicable under the accepted Event Plan because no contributing module is selected.",
                        "已接受的活动计划未选择任何相关模块，因此本节不适用。")],
                    [], []);
            }
            return new(code, new(en, zh), blockers.Length == 0 ? "ready" : "attentionRequired",
                items, moduleCodes, blockers);
        }

        var moduleCodes = modules.Select(x => x.ModuleCode).ToArray();
        return
        [
            Section("overview", "Event overview", "活动概要", [],
                new LocalizedTextDto($"{groupEvent.TitleEn}; {groupEvent.StartDate:u} – {groupEvent.EndDate:u}",
                    $"{groupEvent.TitleZh}；{groupEvent.StartDate:u} 至 {groupEvent.EndDate:u}"),
                new LocalizedTextDto($"Package covers {coveredOccurrenceIds.Count} occurrence(s).",
                    $"审批包覆盖 {coveredOccurrenceIds.Count} 个场次。")),
            Section("structure", "Event structure", "活动结构",
                moduleCodes.Where(x => x is "PROGRAM.PRODUCTION" or "FESTIVAL.OPERATIONS").ToArray(),
                new LocalizedTextDto(groupEvent.EventSeriesId.HasValue ? "Recurring Event with explicit governed occurrence coverage." : "One-off Event with explicit occurrence coverage.",
                    groupEvent.EventSeriesId.HasValue ? "周期活动，具有明确受治理的场次覆盖范围。" : "一次性活动，具有明确的场次覆盖范围。"),
                new LocalizedTextDto($"{modules.Count} accepted Plan module(s) contribute to this version.",
                    $"此版本包含 {modules.Count} 个已接受计划模块的贡献。")),
            Section("peoplePlaceResources", "People, place and resources", "人员、场地与资源",
                moduleCodes.Where(x => x is "TEAM.WORK" or "SERVICE.ROSTER" or "PLACE.RESOURCE" or "MOVE.STAY").ToArray(),
                new LocalizedTextDto(groupEvent.AccountableOwnerMemberId == Guid.Empty ? "Accountable owner is missing." : "An accountable owner is assigned.",
                    groupEvent.AccountableOwnerMemberId == Guid.Empty ? "尚未指定最终责任人。" : "已指定最终责任人。")),
            Section("safetySafeguarding", "Safety and safeguarding", "安全与保障",
                moduleCodes.Where(x => x is "SAFETY.RAM" or "SAFEGUARDING.CHILD" or "MOVE.STAY").ToArray(),
                new LocalizedTextDto($"RAM status: {groupEvent.RamAssessment?.Status.ToString() ?? "missing"}.",
                    $"RAM 状态：{groupEvent.RamAssessment?.Status.ToString() ?? "missing"}。")),
            Section("registrationFinancePrivacyComms", "Registration, finance, privacy and communications", "报名、财务、隐私与沟通",
                moduleCodes.Where(x => x is "PEOPLE.REGISTRATION" or "MONEY.FINANCE" or "COMMS.FOLLOWUP").ToArray(),
                new LocalizedTextDto("Only minimum summaries are copied; participant and financial records remain in their restricted modules.",
                    "这里只复制最小摘要；参与者及财务记录仍保留在各自受限模块中。")),
            Section("specialistDecisions", "Specialist decisions", "专项决定",
                moduleCodes.Where(x => x is "SAFETY.RAM" or "SAFEGUARDING.CHILD" or "MONEY.FINANCE").ToArray(),
                new LocalizedTextDto($"Sponsorship status: {groupEvent.SponsorshipStatus}.", $"主办认可状态：{groupEvent.SponsorshipStatus}。"),
                new LocalizedTextDto("Overall Package approval does not replace any required specialist decision.",
                    "整体审批包批准不会替代任何必需的专项决定。")),
            Section("readinessChanges", "Readiness and changes", "就绪与变化",
                moduleCodes,
                new LocalizedTextDto($"{modules.Sum(x => x.Blockers.Count)} current readiness gap(s) are recorded with their authoritative module.",
                    $"当前记录了 {modules.Sum(x => x.Blockers.Count)} 项就绪缺口，并保留其权威模块归属。"))
        ];
    }

    private static LegacyEventPackageTransition ResolveLegacyTransition(EventPlanSnapshotDto plan,
        EventPackageEnforcementMode mode, LegacyRolloutRule rollout, IReadOnlyList<ModuleDecisionDto> selected)
    {
        if (!plan.IsLegacyBackfill) return LegacyEventPackageTransition.FormalPackageRequired;
        var selectedCodes = selected.Select(x => x.ModuleCode).ToHashSet(StringComparer.Ordinal);
        if (rollout.SafetyCriticalModuleCodes.Any(selectedCodes.Contains)) return LegacyEventPackageTransition.SafetyCriticalBlocked;
        var key = JsonNamingPolicy.CamelCase.ConvertName(mode.ToString());
        if (!rollout.TransitionByMode.TryGetValue(key, out var transition)) return LegacyEventPackageTransition.SafetyCriticalBlocked;
        return transition;
    }

    private async Task<AppResult<GroupEvent>> LoadViewableEvent(Guid eventId, Guid memberId, CancellationToken ct)
    {
        var groupEvent = await db.GroupEvents.AsNoTracking().FirstOrDefaultAsync(x => x.Id == eventId, ct);
        if (groupEvent is null) return AppResult<GroupEvent>.NotFound("Event not found.");
        var rootId = await EventCompositionPersistence.FindChurchRootIdAsync(db, groupEvent.GroupId, ct);
        var canReview = await EventCompositionPersistence.HasDirectGroupLeadershipAsync(db, groupEvent.GroupId, memberId, ct) ||
            (rootId.HasValue && await EventCompositionPersistence.HasDirectGroupLeadershipAsync(db, rootId.Value, memberId, ct)) ||
            await AdminPlatformRoleHelpers.HasPermissionAsync(db, memberId, AdminPermissionCatalog.ApproveEventPackages, ct);
        return await EventCompositionPersistence.CanViewEventTeamAsync(db, authorization, groupEvent, memberId, ct) || canReview ||
            await EventPackageDelegationService.HasActiveViewDelegationAsync(db, groupEvent, memberId, ct)
            ? AppResult<GroupEvent>.Success(groupEvent)
            : AppResult<GroupEvent>.Forbidden("Event team access is required to view Event Packages.");
    }

    private async Task ExpireOverdueConditionsAsync(Guid eventId, Guid groupId, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var overdue = await db.EventPackageConditions.Include(x => x.EventPackage)
            .Where(x => x.EventPackage.EventId == eventId && x.DueUtc <= now &&
                x.Status != EventPackageConditionStatus.Verified && x.Status != EventPackageConditionStatus.Waived &&
                x.Status != EventPackageConditionStatus.Expired)
            .ToListAsync(ct);
        var retainedEvidence = await db.EventPackageConditions.Include(x => x.EventPackage)
            .Where(x => x.EventPackage.EventId == eventId && x.EvidenceReference != null &&
                x.EvidenceExpiresUtc != null && x.EvidenceExpiresUtc <= now &&
                x.EvidenceUnavailableUtc == null)
            .ToListAsync(ct);
        if (overdue.Count == 0 && retainedEvidence.Count == 0) return;
        var groupEvent = await db.GroupEvents.AsNoTracking().FirstAsync(x => x.Id == eventId, ct);
        foreach (var condition in overdue)
        {
            var previous = condition.Status;
            condition.Status = EventPackageConditionStatus.Expired;
            condition.ExpiredUtc = now;
            condition.ConcurrencyToken = Guid.NewGuid();
            await SyncConditionReadinessTaskAsync(condition, null, now, ct);
            db.AuditLogs.Add(new AuditLog
            {
                Id = Guid.NewGuid(), Action = "event.package.condition.expired", EntityType = "EventPackageCondition",
                EntityId = condition.Id, GroupId = groupId, EventId = eventId,
                BeforeJson = EventPackageCanonicalizer.Serialize(new { status = previous, condition.DueUtc }),
                AfterJson = EventPackageCanonicalizer.Serialize(new { condition.Status, condition.ExpiredUtc }),
                MetadataJson = EventPackageCanonicalizer.Serialize(new { systemTransition = true, evidenceContentLogged = false }),
                OccurredUtc = now
            });
            AddNotifications(await ResolveConditionNotificationRecipientsAsync(groupEvent, condition.EventPackage, condition, ct),
                condition.EventPackage.GeneratedByMemberId, groupEvent, condition.EventPackage,
                "event.package.condition.expired", now,
                new { conditionId = condition.Id, condition.AppliesToGate, condition.Status,
                    nextAction = "event.package.condition.review" });
        }
        foreach (var condition in retainedEvidence)
        {
            condition.EvidenceReferenceHash ??= EventPackageCanonicalizer.HashCanonical(condition.EvidenceReference!);
            condition.EvidenceReference = null;
            condition.EvidenceUnavailableUtc = now;
            condition.ConcurrencyToken = Guid.NewGuid();
            db.AuditLogs.Add(new AuditLog
            {
                Id = Guid.NewGuid(), Action = "event.package.condition.evidenceMadeUnavailable",
                EntityType = "EventPackageCondition", EntityId = condition.Id,
                GroupId = groupId, EventId = eventId,
                BeforeJson = EventPackageCanonicalizer.Serialize(new
                {
                    evidenceAvailable = true, condition.EvidenceExpiresUtc,
                    evidenceReferenceHash = condition.EvidenceReferenceHash
                }),
                AfterJson = EventPackageCanonicalizer.Serialize(new
                {
                    evidenceAvailable = false, condition.EvidenceUnavailableUtc,
                    evidenceReferenceHash = condition.EvidenceReferenceHash
                }),
                MetadataJson = EventPackageCanonicalizer.Serialize(new
                {
                    dataClass = "approvalEvidence", retentionDaysAfterEvent = ConditionEvidenceRetentionDaysAfterEvent,
                    personalEvidenceContentLogged = false, minimumAuditChainPreserved = true
                }),
                OccurredUtc = now
            });
        }
        await db.SaveChangesAsync(ct);
        if (cacheInvalidation is not null) await cacheInvalidation.RemoveGroupEventsAsync(groupId, ct);
    }

    private IQueryable<EventPackage> PackageQuery(bool asNoTracking = false)
    {
        IQueryable<EventPackage> query = db.EventPackages;
        if (asNoTracking) query = query.AsNoTracking();
        return query.Include(x => x.SourceReferences).Include(x => x.Decisions).Include(x => x.Conditions);
    }

    private IQueryable<GroupEvent> LifecycleEventQuery(bool asNoTracking = false)
    {
        IQueryable<GroupEvent> query = db.GroupEvents;
        if (asNoTracking) query = query.AsNoTracking();
        return query.Include(x => x.RamAssessment)
            .Include(x => x.PublishedPackage).ThenInclude(x => x!.Conditions)
            .Include(x => x.PublishedPackage).ThenInclude(x => x!.Decisions)
            .Include(x => x.RegistrationPackage).ThenInclude(x => x!.Conditions)
            .Include(x => x.RegistrationPackage).ThenInclude(x => x!.Decisions)
            .Include(x => x.ExecutionPackage).ThenInclude(x => x!.Conditions)
            .Include(x => x.ExecutionPackage).ThenInclude(x => x!.Decisions);
    }

    private async Task<IReadOnlyList<string>> EvaluatePublishPackageAsync(GroupEvent groupEvent, EventPackage package,
        string? packageETag, EventPackageGovernancePolicyVersion? policy, DateTime now, CancellationToken ct)
    {
        var reasons = new List<string>();
        if (package.ScopeType != EventPackageScopeType.Event || package.ScopeId.HasValue)
            reasons.Add("event.publish.packageScopeMismatch");
        if (!Matches(packageETag, ETag(package))) reasons.Add("event.publish.packageChanged");
        reasons.AddRange(EventPackageGateEvaluator.Evaluate(EventLifecycleGate.Publish,
            policy?.EnforcementMode ?? EventPackageEnforcementMode.Off, package, now).ReasonCodes);
        if (policy is not null && package.GovernancePolicyVersionId != policy.Id)
            reasons.Add("event.publish.policyChanged");
        if (reasons.Count == 0)
        {
            var capture = await CaptureAsync(groupEvent.Id,
                new GenerateEventPackageRequest(package.ScopeType, package.ScopeId, package.PackageSchemaVersion), ct);
            if (!capture.IsSuccess || !string.Equals(capture.Value!.SourceVectorHash, package.SourceVectorHash, StringComparison.Ordinal) ||
                capture.Value.Plan.PlanVersion != package.EventPlanVersion || capture.Value.Policy.Id != package.GovernancePolicyVersionId)
                reasons.Add("event.publish.packageSourceChanged");
        }
        return reasons;
    }

    private async Task<IReadOnlyList<string>> EvaluateRegistrationPackageAsync(GroupEvent groupEvent, EventPackage package,
        string? packageETag, EventPackageGovernancePolicyVersion? policy, DateTime now, CancellationToken ct)
    {
        var reasons = new List<string>();
        if (package.ScopeType != EventPackageScopeType.Event || package.ScopeId.HasValue)
            reasons.Add("event.registration.packageScopeMismatch");
        if (!Matches(packageETag, ETag(package))) reasons.Add("event.registration.packageChanged");
        reasons.AddRange(EventPackageGateEvaluator.Evaluate(EventLifecycleGate.Registration,
            policy?.EnforcementMode ?? EventPackageEnforcementMode.Off, package, now).ReasonCodes);
        if (policy is not null && package.GovernancePolicyVersionId != policy.Id)
            reasons.Add("event.registration.policyChanged");
        if (reasons.Count == 0)
        {
            var capture = await CaptureAsync(groupEvent.Id,
                new GenerateEventPackageRequest(package.ScopeType, package.ScopeId, package.PackageSchemaVersion), ct);
            if (!capture.IsSuccess || !string.Equals(capture.Value!.SourceVectorHash, package.SourceVectorHash, StringComparison.Ordinal) ||
                capture.Value.Plan.PlanVersion != package.EventPlanVersion || capture.Value.Policy.Id != package.GovernancePolicyVersionId)
                reasons.Add("event.registration.packageSourceChanged");
        }
        return reasons.Distinct(StringComparer.Ordinal).ToArray();
    }

    private Task<EventPackageGovernancePolicyVersion?> CurrentPolicyAsync(Guid groupId, DateTime now, CancellationToken ct)
        => db.EventPackageGovernancePolicyVersions.AsNoTracking()
            .Where(x => x.IsPublished && x.EffectiveFromUtc <= now && (!x.RetiredUtc.HasValue || x.RetiredUtc > now) &&
                (x.OrganisationId == groupId || x.OrganisationId == null))
            .OrderByDescending(x => x.OrganisationId == groupId).ThenByDescending(x => x.EffectiveFromUtc)
            .FirstOrDefaultAsync(ct);

    private async Task<bool> CanManageRegistrationAsync(GroupEvent groupEvent, Guid memberId,
        bool allowGroupLeadership, CancellationToken ct)
    {
        if (groupEvent.AccountableOwnerMemberId == memberId) return true;
        if (await db.EventRoleAssignments.AsNoTracking().AnyAsync(x => x.EventId == groupEvent.Id &&
            x.MemberId == memberId && x.Status == EventRoleAssignmentStatus.Accepted && x.EndedUtc == null &&
            x.RoleRequirementKey.EndsWith(":registration.manager"), ct)) return true;
        return allowGroupLeadership && await EventCompositionPersistence.HasDirectGroupLeadershipAsync(
            db, groupEvent.GroupId, memberId, ct);
    }

    private async Task<bool> CanConfirmExecutionAsync(GroupEvent groupEvent, Guid memberId, CancellationToken ct)
        => groupEvent.AccountableOwnerMemberId == memberId ||
           await db.EventRoleAssignments.AsNoTracking().AnyAsync(x => x.EventId == groupEvent.Id &&
               x.MemberId == memberId && x.Status == EventRoleAssignmentStatus.Accepted && x.EndedUtc == null &&
               x.RoleRequirementKey.EndsWith(":event.lead"), ct);

    private static EventLifecycleDto ToLifecycleDto(GroupEvent groupEvent, DateTime now,
        EventPackage? currentCandidate = null, EventPackageEnforcementMode? currentMode = null,
        IReadOnlyList<string>? additionalExecutionReasons = null, Guid? executionScopeId = null,
        EventOccurrence? executionOccurrence = null, EventPackage? occurrenceExecutionPackage = null)
    {
        var publishEvaluation = groupEvent.PublicationStatus == EventPublicationStatus.Published
            ? EventPackageGateEvaluator.Evaluate(EventLifecycleGate.Publish, groupEvent.PublicationGateMode, groupEvent.PublishedPackage, now)
            : EventPackageGateEvaluator.Evaluate(EventLifecycleGate.Publish,
                currentMode ?? groupEvent.PublicationGateMode, currentCandidate, now);
        var registrationEvaluation = groupEvent.RegistrationStatus == EventRegistrationStatus.Open
            ? EventPackageGateEvaluator.Evaluate(EventLifecycleGate.Registration, groupEvent.RegistrationGateMode, groupEvent.RegistrationPackage, now)
            : EventPackageGateEvaluator.Evaluate(EventLifecycleGate.Registration,
                currentMode ?? groupEvent.RegistrationGateMode, currentCandidate, now);
        var executionStatus = executionOccurrence?.ExecutionStatus ?? groupEvent.ExecutionStatus;
        var executionPackageId = executionOccurrence?.ExecutionPackageId ?? groupEvent.ExecutionPackageId;
        var executionConfirmedUtc = executionOccurrence?.ExecutionConfirmedUtc ?? groupEvent.ExecutionConfirmedUtc;
        var executionGateMode = executionOccurrence?.ExecutionGateMode ?? groupEvent.ExecutionGateMode;
        var executionPackage = executionOccurrence is null ? groupEvent.ExecutionPackage : occurrenceExecutionPackage;
        var executionEvaluation = executionStatus == EventExecutionStatus.Confirmed
            ? EventPackageGateEvaluator.Evaluate(EventLifecycleGate.Execute, executionGateMode, executionPackage, now)
            : EventPackageGateEvaluator.Evaluate(EventLifecycleGate.Execute,
                currentMode ?? executionGateMode, currentCandidate, now);
        if (additionalExecutionReasons?.Count > 0)
        {
            var reasons = executionEvaluation.ReasonCodes.Concat(additionalExecutionReasons)
                .Distinct(StringComparer.Ordinal).ToArray();
            executionEvaluation = executionEvaluation with
            {
                Allowed = executionEvaluation.EnforcementMode != EventPackageEnforcementMode.Enforced,
                RequirementsSatisfied = false,
                ReasonCodes = reasons
            };
        }
        var paymentPackage = groupEvent.RegistrationPackage ?? groupEvent.PublishedPackage ?? currentCandidate;
        var paymentMode = currentMode ?? (groupEvent.RegistrationStatus == EventRegistrationStatus.Open
            ? groupEvent.RegistrationGateMode : groupEvent.PublicationGateMode);
        var paymentReasons = EventPackageGateEvaluator.Evaluate(
            EventLifecycleGate.Payment, paymentMode, paymentPackage, now).ReasonCodes
            .Append(EventPackageGateEvaluator.Reason(EventLifecycleGate.Payment, "capabilityUnavailable"))
            .Distinct(StringComparer.Ordinal).ToArray();
        var paymentEvaluation = new EventPackageGateEvaluation(
            EventLifecycleGate.Payment, paymentMode, false, false, paymentReasons);
        var gates = new[]
        {
            ToGateDto(publishEvaluation, groupEvent.PublicationStatus == EventPublicationStatus.Published
                ? groupEvent.PublishedPackage : currentCandidate, now),
            ToGateDto(registrationEvaluation, groupEvent.RegistrationStatus == EventRegistrationStatus.Open
                ? groupEvent.RegistrationPackage : currentCandidate, now),
            ToGateDto(paymentEvaluation, paymentPackage, now),
            ToGateDto(executionEvaluation, executionStatus == EventExecutionStatus.Confirmed
                ? executionPackage : currentCandidate, now,
                executionScopeId.HasValue ? EventPackageScopeType.Occurrence : null, executionScopeId)
        };
        return new(groupEvent.Id, groupEvent.PublicationStatus, groupEvent.PublishedPackageId,
            groupEvent.PublishedUtc, publishEvaluation.EnforcementMode, publishEvaluation.RequirementsSatisfied,
            publishEvaluation.ReasonCodes, LifecycleETag(groupEvent), groupEvent.RegistrationStatus,
            groupEvent.RegistrationPackageId, groupEvent.RegistrationOpenedUtc, registrationEvaluation.EnforcementMode,
            registrationEvaluation.RequirementsSatisfied, registrationEvaluation.ReasonCodes, RegistrationETag(groupEvent),
            executionStatus, executionPackageId, executionConfirmedUtc,
            executionEvaluation.EnforcementMode, executionEvaluation.RequirementsSatisfied, executionEvaluation.ReasonCodes,
            executionOccurrence is null ? ExecutionETag(groupEvent) : ExecutionETag(executionOccurrence),
            paymentEvaluation.RequirementsSatisfied, paymentEvaluation.ReasonCodes, gates);
    }

    private static EventLifecycleGateEvaluationDto ToGateDto(
        EventPackageGateEvaluation evaluation, EventPackage? package, DateTime now,
        EventPackageScopeType? scopeTypeOverride = null, Guid? scopeIdOverride = null)
        => new(evaluation.Gate, evaluation.EnforcementMode, scopeTypeOverride ?? package?.ScopeType ?? EventPackageScopeType.Event,
            scopeTypeOverride.HasValue ? scopeIdOverride : package?.ScopeId,
            evaluation.Allowed, evaluation.RequirementsSatisfied, now, package?.EventPlanVersion,
            package?.Version, package?.GovernancePolicyVersion,
            evaluation.ReasonCodes.Select(ToGateBlocker).ToArray(), []);

    private static EventLifecycleGateBlockerDto ToGateBlocker(string code)
    {
        var (message, role, action) = code switch
        {
            var value when value.EndsWith(".packageMissing", StringComparison.Ordinal) =>
                (new LocalizedTextDto("Generate and approve a current Event Package.", "请生成并批准当前活动方案审批包。"), "event.lead", "event.package.generate"),
            var value when value.EndsWith(".packageNotApproved", StringComparison.Ordinal) ||
                value.EndsWith(".approvalDecisionMissing", StringComparison.Ordinal) ||
                value.EndsWith(".approvalQuorumMissing", StringComparison.Ordinal) =>
                (new LocalizedTextDto("The current Package still needs its required approval decision.", "当前审批包仍缺少必要的批准决定。"), "package.approver", "event.package.decide"),
            var value when value.EndsWith(".approvalExpired", StringComparison.Ordinal) =>
                (new LocalizedTextDto("The Package approval has expired; generate and submit a current version.", "审批包批准已过期；请生成并提交当前版本。"), "event.lead", "event.package.generate"),
            var value when value.EndsWith(".conditionOpen", StringComparison.Ordinal) =>
                (new LocalizedTextDto("A condition for this gate still needs evidence and verification.", "此门槛仍有条件需要提交证据并核验。"), "condition.owner", "event.package.condition.satisfy"),
            var value when value.EndsWith(".conditionExpired", StringComparison.Ordinal) =>
                (new LocalizedTextDto("A condition for this gate expired before verification.", "此门槛的一项条件在核验前已过期。"), "package.approver", "event.package.condition.review"),
            var value when value.EndsWith(".readinessBlocked", StringComparison.Ordinal) =>
                (new LocalizedTextDto("One or more authoritative module readiness requirements are blocked.", "一个或多个权威模块的就绪要求仍受阻。"), "event.team", "event.readiness.review"),
            var value when value.EndsWith(".occurrenceReviewRequired", StringComparison.Ordinal) =>
                (new LocalizedTextDto("One occurrence has a Package-relevant exception and needs a scoped review before execution.", "某个场次存在影响审批包的例外，执行前需要完成该场次的范围化复审。"), "event.lead", "event.package.generateOccurrenceReview"),
            var value when value.EndsWith(".capabilityUnavailable", StringComparison.Ordinal) =>
                (new LocalizedTextDto("Payment, deposit, and fee acceptance are not implemented and remain unavailable.", "付款、押金和收费确认尚未实现，当前不可用。"), "system.admin", "event.payment.unavailable"),
            _ => (new LocalizedTextDto("This lifecycle gate is blocked; refresh the Package evidence and review the reason code.",
                    "此生命周期门槛受阻；请刷新审批包证据并查看原因代码。"),
                "event.lead", "event.package.review")
        };
        return new(code, message, role, action);
    }

    private async Task<AppResult<EventLifecycleDto>?> ReplayLifecycleAsync(
        string operation, Guid eventId, string key, string requestHash, CancellationToken ct,
        Guid? occurrenceId = null)
    {
        var existing = await db.EventIdempotencyRecords.AsNoTracking().FirstOrDefaultAsync(
            x => x.Operation == operation && x.ScopeId == eventId && x.Key == key.Trim(), ct);
        if (existing is null) return null;
        if (!string.Equals(existing.RequestHash, requestHash, StringComparison.Ordinal))
            return AppResult<EventLifecycleDto>.Conflict("The Idempotency-Key was already used with a different lifecycle request.");
        var groupEvent = await LifecycleEventQuery(asNoTracking: true).FirstOrDefaultAsync(x => x.Id == eventId, ct);
        if (groupEvent is null) return AppResult<EventLifecycleDto>.NotFound("Event not found.");
        if (!occurrenceId.HasValue) return AppResult<EventLifecycleDto>.Success(ToLifecycleDto(groupEvent, DateTime.UtcNow));
        var occurrence = await db.EventOccurrences.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == occurrenceId && x.EventId == eventId, ct);
        if (occurrence is null) return AppResult<EventLifecycleDto>.NotFound("Event occurrence not found.");
        var package = occurrence.ExecutionPackageId.HasValue
            ? await PackageQuery(asNoTracking: true).FirstOrDefaultAsync(x => x.Id == occurrence.ExecutionPackageId, ct)
            : null;
        return AppResult<EventLifecycleDto>.Success(ToLifecycleDto(groupEvent, DateTime.UtcNow,
            package, occurrence.ExecutionGateMode, null, occurrence.Id, occurrence, package));
    }

    private async Task<AppResult<EventPackageConditionResultDto>?> ReplayConditionAsync(string operation, Guid eventId,
        Guid packageId, Guid conditionId, string key, string requestHash, CancellationToken ct)
    {
        var existing = await db.EventIdempotencyRecords.AsNoTracking().FirstOrDefaultAsync(
            x => x.Operation == operation && x.ScopeId == conditionId && x.Key == key.Trim(), ct);
        if (existing is null) return null;
        if (!string.Equals(existing.RequestHash, requestHash, StringComparison.Ordinal))
            return AppResult<EventPackageConditionResultDto>.Conflict("The Idempotency-Key was already used with a different condition request.");
        var package = await PackageQuery(asNoTracking: true).FirstOrDefaultAsync(x => x.Id == packageId && x.EventId == eventId, ct);
        var condition = package?.Conditions.FirstOrDefault(x => x.Id == conditionId);
        if (condition is null) return AppResult<EventPackageConditionResultDto>.NotFound("Event Package condition not found.");
        var groupEvent = await LifecycleEventQuery(asNoTracking: true).FirstAsync(x => x.Id == eventId, ct);
        return AppResult<EventPackageConditionResultDto>.Success(new(ToConditionDto(condition), ToLifecycleDto(groupEvent, DateTime.UtcNow)));
    }

    private async Task<AppResult<EventLifecycleDto>> SaveLifecycleAsync(
        GroupEvent groupEvent, IAlifeTransaction? transaction, CancellationToken ct,
        EventOccurrence? executionOccurrence = null, EventPackage? occurrenceExecutionPackage = null,
        EventPackageEnforcementMode? currentMode = null)
    {
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException) { return AppResult<EventLifecycleDto>.Conflict("event.lifecycle.concurrentChange"); }
        catch (DbUpdateException) { return AppResult<EventLifecycleDto>.Conflict("The Event lifecycle operation conflicted with another request."); }
        if (transaction is not null) await transaction.CommitAsync(ct);
        return AppResult<EventLifecycleDto>.Success(ToLifecycleDto(groupEvent, DateTime.UtcNow,
            occurrenceExecutionPackage, currentMode, null, executionOccurrence?.Id,
            executionOccurrence, occurrenceExecutionPackage));
    }

    private async Task<IReadOnlyCollection<Guid>> ResolveApprovalNotificationRecipientsAsync(
        GroupEvent groupEvent, EventPackage package, CancellationToken ct)
    {
        var recipients = new HashSet<Guid>();
        if (package.GovernanceTier == EventGovernanceTier.Light && groupEvent.AccountableOwnerMemberId != Guid.Empty)
            recipients.Add(groupEvent.AccountableOwnerMemberId);
        if (package.GovernanceTier == EventGovernanceTier.Standard)
        {
            recipients.UnionWith(await db.GroupMemberships.AsNoTracking()
                .Where(x => x.GroupId == groupEvent.GroupId && x.Status == MembershipStatus.Approved &&
                    (x.Role == MembershipRole.Leader || x.Role == MembershipRole.CoLeader))
                .Select(x => x.MemberId).ToListAsync(ct));
        }
        if (package.GovernanceTier != EventGovernanceTier.Light)
        {
            var rootId = await EventCompositionPersistence.FindChurchRootIdAsync(db, groupEvent.GroupId, ct);
            if (rootId.HasValue)
                recipients.UnionWith(await db.GroupMemberships.AsNoTracking()
                    .Where(x => x.GroupId == rootId.Value && x.Status == MembershipStatus.Approved &&
                        (x.Role == MembershipRole.Leader || x.Role == MembershipRole.CoLeader))
                    .Select(x => x.MemberId).ToListAsync(ct));
        }
        if (package.GovernanceTier == EventGovernanceTier.Enhanced)
            recipients.UnionWith(await db.MemberPlatformRoles.AsNoTracking()
                .Where(x => x.RevokedUtc == null &&
                    x.Role.PermissionsJson.Contains(AdminPermissionCatalog.ApproveEventPackages))
                .Select(x => x.MemberId).Distinct().ToListAsync(ct));

        var delegatedCandidates = await db.EventPackageApprovalDelegations.AsNoTracking()
            .Where(x => x.OrganisationId == groupEvent.GroupId && x.PermissionCode == DecideOperation &&
                x.RevokedUtc == null && x.StartsUtc <= DateTime.UtcNow && x.ExpiresUtc > DateTime.UtcNow)
            .Select(x => x.DelegatedToMemberId).Distinct().ToListAsync(ct);
        foreach (var candidate in delegatedCandidates)
            if (await EventPackageDelegationService.FindActiveDecisionDelegationAsync(
                    db, groupEvent, package, candidate, ct) is not null)
                recipients.Add(candidate);
        return recipients;
    }

    private void AddNotifications(IEnumerable<Guid> recipientMemberIds, Guid actorMemberId,
        GroupEvent groupEvent, EventPackage package, string actionType, DateTime now, object actionData)
    {
        var data = EventPackageCanonicalizer.Serialize(new
        {
            eventId = groupEvent.Id, packageId = package.Id, package.Version,
            package.GovernanceTier, actionData
        });
        db.NotificationMessages.AddRange(recipientMemberIds.Where(x => x != actorMemberId).Distinct().Select(recipient =>
            new NotificationMessage
            {
                Id = Guid.NewGuid(), RecipientMemberId = recipient, CreatedByMemberId = actorMemberId,
                GroupId = groupEvent.GroupId, EventId = groupEvent.Id, OccurredUtc = now,
                ActionType = actionType, ActionDataJson = data, CreatedUtc = now, UpdatedUtc = now
            }));
    }

    private async Task<IReadOnlyCollection<Guid>> ResolveConditionNotificationRecipientsAsync(
        GroupEvent groupEvent, EventPackage package, EventPackageCondition condition, CancellationToken ct)
    {
        var recipients = new HashSet<Guid>(new[]
        {
            groupEvent.AccountableOwnerMemberId,
            package.GeneratedByMemberId
        });
        if (package.SubmittedByMemberId.HasValue) recipients.Add(package.SubmittedByMemberId.Value);
        recipients.UnionWith(await db.EventRoleAssignments.AsNoTracking()
            .Where(x => x.EventId == groupEvent.Id && x.RoleRequirementKey == condition.OwnerRoleRequirementKey &&
                x.Status == EventRoleAssignmentStatus.Accepted && x.EndedUtc == null)
            .Select(x => x.MemberId).ToListAsync(ct));
        recipients.UnionWith(await ResolveApprovalNotificationRecipientsAsync(groupEvent, package, ct));
        return recipients;
    }

    private static string ConditionNextAction(EventPackageConditionStatus status) => status switch
    {
        EventPackageConditionStatus.EvidenceSubmitted => "event.package.condition.verify",
        EventPackageConditionStatus.Rejected => "event.package.condition.satisfy",
        EventPackageConditionStatus.Verified or EventPackageConditionStatus.Waived => "event.package.gates.review",
        EventPackageConditionStatus.Expired => "event.package.condition.review",
        _ => "event.package.condition.satisfy"
    };

    private void AddLifecycleAudit(string action, GroupEvent groupEvent, Guid actor, DateTime now, object before, object after)
        => db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(), ActorMemberId = actor, Action = action, EntityType = "GroupEvent",
            EntityId = groupEvent.Id, GroupId = groupEvent.GroupId, EventId = groupEvent.Id,
            BeforeJson = EventPackageCanonicalizer.Serialize(before), AfterJson = EventPackageCanonicalizer.Serialize(after),
            MetadataJson = EventPackageCanonicalizer.Serialize(new
            {
                groupEvent.PublishedPackageId, groupEvent.PublicationGateMode
            }), OccurredUtc = now
        });

    private async Task<bool> CanSubmitAsync(GroupEvent groupEvent, Guid memberId, CancellationToken ct)
        => await EventCompositionPersistence.CanManageEventAsync(db, authorization, groupEvent, memberId, ct) ||
           await db.EventRoleAssignments.AsNoTracking().AnyAsync(x => x.EventId == groupEvent.Id &&
               x.MemberId == memberId && x.Status == EventRoleAssignmentStatus.Accepted && x.EndedUtc == null &&
               x.RoleRequirementKey.EndsWith(":event.lead"), ct);

    private async Task<DecisionAuthority> ResolveDecisionAuthorityAsync(
        GroupEvent groupEvent, EventPackage package, Guid memberId, CancellationToken ct)
    {
        if (package.GovernanceTier != EventGovernanceTier.Light && package.SubmittedByMemberId == memberId)
            return DecisionAuthority.Deny("The Package submitter cannot decide a standard or enhanced Package.");
        if (package.GovernanceTier == EventGovernanceTier.Enhanced &&
            await IsAffectedSpecialistAuthorAsync(groupEvent.Id, package, memberId, ct))
            return DecisionAuthority.Deny("An affected specialist decision author cannot decide this enhanced Package.");
        var delegation = await EventPackageDelegationService.FindActiveDecisionDelegationAsync(db, groupEvent, package, memberId, ct);
        if (delegation is not null)
            return DecisionAuthority.Allow($"delegated:{delegation.PermissionCode}:{delegation.Id:N}", delegation.OrganisationId);
        if (package.GovernanceTier == EventGovernanceTier.Light)
            return groupEvent.AccountableOwnerMemberId == memberId
                ? DecisionAuthority.Allow("event.accountableOwner", groupEvent.GroupId)
                : DecisionAuthority.Deny("The accountable Event owner is required to decide a light Package.");

        if (package.GovernanceTier == EventGovernanceTier.Standard)
        {
            if (await EventCompositionPersistence.HasDirectGroupLeadershipAsync(db, groupEvent.GroupId, memberId, ct))
                return DecisionAuthority.Allow("owningGroup.leaderOrCoLeader", groupEvent.GroupId);
            var rootId = await EventCompositionPersistence.FindChurchRootIdAsync(db, groupEvent.GroupId, ct);
            return rootId.HasValue && await EventCompositionPersistence.HasDirectGroupLeadershipAsync(db, rootId.Value, memberId, ct)
                ? DecisionAuthority.Allow("rootChurch.leaderOrCoLeader.fallback", rootId.Value)
                : DecisionAuthority.Deny("Owning-group leadership, or root-church leadership as fallback, is required to decide a standard Package.");
        }

        var churchRootId = await EventCompositionPersistence.FindChurchRootIdAsync(db, groupEvent.GroupId, ct);
        if (churchRootId.HasValue && await EventCompositionPersistence.HasDirectGroupLeadershipAsync(db, churchRootId.Value, memberId, ct))
            return DecisionAuthority.Allow("rootChurch.leaderOrCoLeader", churchRootId.Value);
        if (await AdminPlatformRoleHelpers.HasPermissionAsync(db, memberId, AdminPermissionCatalog.ApproveEventPackages, ct))
            return DecisionAuthority.Allow(AdminPermissionCatalog.ApproveEventPackages, churchRootId);
        return DecisionAuthority.Deny("Root-church leadership or the Event Package approval permission is required to decide an enhanced Package.");
    }

    private async Task<bool> IsAffectedSpecialistAuthorAsync(Guid eventId, EventPackage package, Guid memberId, CancellationToken ct)
    {
        EventPackageManifestDto manifest;
        try { manifest = JsonSerializer.Deserialize<EventPackageManifestDto>(package.ManifestJson, JsonOptions)!; }
        catch (JsonException) { return true; }
        if (manifest is null) return true;
        var modules = manifest.Modules.Select(x => x.ModuleCode).ToHashSet(StringComparer.Ordinal);
        if (modules.Contains("SAFETY.RAM") && await db.EventRamAssessments.AsNoTracking().AnyAsync(x => x.EventId == eventId &&
            (x.SubmittedByMemberId == memberId || x.ApprovedByMemberId == memberId), ct)) return true;
        if (modules.Contains("SAFEGUARDING.CHILD") && await db.EventSafeguardingConfigurations.AsNoTracking()
            .AnyAsync(x => x.EventId == eventId && x.ConfiguredByMemberId == memberId, ct)) return true;
        return await db.EventApprovalDecisions.AsNoTracking().AnyAsync(x => x.EventId == eventId && x.ActorMemberId == memberId, ct);
    }

    private async Task<AppResult<EventPackageDto>?> ReplayAsync(
        string operation, Guid packageId, string key, string requestHash, CancellationToken ct)
    {
        var existing = await db.EventIdempotencyRecords.AsNoTracking().FirstOrDefaultAsync(
            x => x.Operation == operation && x.ScopeId == packageId && x.Key == key.Trim(), ct);
        if (existing is null) return null;
        if (!string.Equals(existing.RequestHash, requestHash, StringComparison.Ordinal))
            return AppResult<EventPackageDto>.Conflict("The Idempotency-Key was already used with a different Package request.");
        var package = await PackageQuery(asNoTracking: true).FirstOrDefaultAsync(x => x.Id == packageId, ct);
        return package is null
            ? AppResult<EventPackageDto>.Conflict("The idempotent Package result is no longer available.")
            : AppResult<EventPackageDto>.Success(ToDto(package));
    }

    private void AddIdempotency(string operation, Guid packageId, string key, string requestHash, Guid resultId, DateTime now)
        => db.EventIdempotencyRecords.Add(new EventIdempotencyRecord
        {
            Id = Guid.NewGuid(), Operation = operation, ScopeId = packageId, Key = key.Trim(),
            RequestHash = requestHash, ResultEntityId = resultId, CreatedUtc = now, ExpiresUtc = now.AddHours(24)
        });

    private void AddAudit(string action, GroupEvent groupEvent, Guid actor, EventPackage package, DateTime now,
        object before, object after)
        => db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(), ActorMemberId = actor, Action = action, EntityType = "EventPackage",
            EntityId = package.Id, GroupId = groupEvent.GroupId, EventId = groupEvent.Id,
            BeforeJson = EventPackageCanonicalizer.Serialize(before), AfterJson = EventPackageCanonicalizer.Serialize(after),
            MetadataJson = EventPackageCanonicalizer.Serialize(new
            {
                package.ScopeType, package.ScopeId, package.Version, package.ContentHash,
                package.SourceVectorHash, package.GovernancePolicyVersion, package.GovernanceTier
            }), OccurredUtc = now
        });

    private async Task<AppResult<EventPackageDto>> SavePackageAsync(
        EventPackage package, IAlifeTransaction? transaction, CancellationToken ct)
    {
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException) { return AppResult<EventPackageDto>.Conflict("event.package.concurrentChange"); }
        catch (DbUpdateException) { return AppResult<EventPackageDto>.Conflict("The Package operation was already completed or conflicted with another request."); }
        if (transaction is not null) await transaction.CommitAsync(ct);
        return AppResult<EventPackageDto>.Success(ToDto(package));
    }

    private static string? ValidateDecision(EventPackageDecisionRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Reason.En) || string.IsNullOrWhiteSpace(request.Reason.Zh))
            return "A bilingual decision reason is required.";
        if (request.Reason.En.Trim().Length > 2000 || request.Reason.Zh.Trim().Length > 2000)
            return "Each decision reason must be at most 2000 characters.";
        if (request.ExpiresUtc.HasValue && AsUtc(request.ExpiresUtc.Value) <= DateTime.UtcNow)
            return "The decision expiry must be in the future.";
        if (request.DecisionType == EventPackageDecisionType.ApproveWithConditions)
        {
            if (request.Conditions is null || request.Conditions.Count == 0)
                return "Approve with conditions requires at least one structured condition.";
            if (request.Conditions.Any(x => string.IsNullOrWhiteSpace(x.Text.En) || string.IsNullOrWhiteSpace(x.Text.Zh) ||
                string.IsNullOrWhiteSpace(x.OwnerRoleRequirementKey) || AsUtc(x.DueUtc) <= DateTime.UtcNow))
                return "Every condition requires bilingual text, an owner role requirement, a gate, and a future due time.";
            if (request.Conditions.Any(x => x.Text.En.Trim().Length > 2000 || x.Text.Zh.Trim().Length > 2000 ||
                x.OwnerRoleRequirementKey.Trim().Length > 160))
                return "A condition exceeds its maximum text length.";
        }
        else if (request.Conditions is { Count: > 0 })
            return "Conditions are allowed only for approveWithConditions.";
        return null;
    }

    private static EventPackageDto ToDto(EventPackage package)
        => new(package.Id, package.EventId, package.ScopeType, package.ScopeId, package.CoverageMode,
            JsonSerializer.Deserialize<Guid[]>(package.CoveredOccurrenceIdsJson, JsonOptions) ?? [], package.Version,
            package.EventPlanVersion, package.PackageSchemaVersion, package.GovernancePolicyVersion, package.GovernanceTier,
            package.Status, package.ApprovalValidityStatus, package.ContentHash, package.SourceVectorHash,
            JsonSerializer.Deserialize<EventPackageManifestDto>(package.ManifestJson, JsonOptions)
                ?? throw new JsonException("Event Package manifest is missing."),
            package.SourceReferences.OrderBy(x => x.ModuleCode, StringComparer.Ordinal).ThenBy(x => x.SubjectType, StringComparer.Ordinal)
                .ThenBy(x => x.SubjectId).Select(x => new EventPackageSourceReferenceDto(x.ModuleCode, x.SubjectType,
                    x.SubjectId, x.SubjectVersion, x.SourceDecisionId, x.ValidUntilUtc, x.DataClass,
                    x.RequiredForDecision, x.CapturedUtc)).ToArray(),
            package.Decisions.OrderBy(x => x.DecidedUtc).ThenBy(x => x.Id).Select(x => new EventPackageDecisionDto(
                x.Id, x.DecisionType, x.ActorMemberId, new(x.ReasonEn, x.ReasonZh), x.DecidedUtc,
                x.EffectiveUtc, x.ExpiresUtc, x.RevokedByDecisionId, x.InvalidatedReasonCode)).ToArray(),
            package.Conditions.OrderBy(x => x.DueUtc).ThenBy(x => x.Id).Select(x => ToConditionDto(x, DateTime.UtcNow)).ToArray(),
            package.SupersedesPackageId, package.GeneratedByMemberId, package.GeneratedUtc, ETag(package));

    private static EventPackageConditionDto ToConditionDto(EventPackageCondition condition, DateTime? utcNow = null)
    {
        var now = utcNow ?? DateTime.UtcNow;
        var isExpired = condition.Status is not (EventPackageConditionStatus.Verified or EventPackageConditionStatus.Waived) &&
            condition.DueUtc <= now;
        var effectiveStatus = isExpired ? EventPackageConditionStatus.Expired : condition.Status;
        var expiredUtc = isExpired ? condition.ExpiredUtc ?? condition.DueUtc : condition.ExpiredUtc;
        return new(condition.Id, condition.ReadinessTaskId, new(condition.TextEn, condition.TextZh), condition.AppliesToGate,
            condition.OwnerRoleRequirementKey, condition.DueUtc, effectiveStatus, expiredUtc,
            condition.EvidenceReference, condition.EvidenceReferenceHash, condition.EvidenceExpiresUtc,
            condition.EvidenceUnavailableUtc, condition.EvidenceReference is not null,
            condition.SatisfiedByMemberId, condition.SatisfiedUtc,
            condition.VerifiedByMemberId, condition.VerifiedUtc, ConditionETag(condition));
    }

    private async Task SyncConditionReadinessTaskAsync(
        EventPackageCondition condition, Guid? actorMemberId, DateTime now, CancellationToken ct)
    {
        if (!condition.ReadinessTaskId.HasValue) return;
        var task = await db.EventTasks.FirstOrDefaultAsync(x => x.Id == condition.ReadinessTaskId.Value, ct);
        if (task is null) return;
        task.Status = condition.Status switch
        {
            EventPackageConditionStatus.Open => EventTaskStatus.Todo,
            EventPackageConditionStatus.EvidenceSubmitted or EventPackageConditionStatus.Rejected => EventTaskStatus.InProgress,
            EventPackageConditionStatus.Verified or EventPackageConditionStatus.Waived => EventTaskStatus.Done,
            EventPackageConditionStatus.Expired => EventTaskStatus.Blocked,
            _ => EventTaskStatus.Blocked
        };
        task.CompletedUtc = task.Status == EventTaskStatus.Done ? now : null;
        task.ConcurrencyToken = Guid.NewGuid();
        task.UpdatedUtc = now;
    }

    private static IReadOnlyList<EventPackageDiffFieldDto> BuildDiff(
        EventPackage from,
        EventPackageManifestDto fromManifest,
        EventPackage to,
        EventPackageManifestDto toManifest)
    {
        var changes = new List<EventPackageDiffFieldDto>();
        Add("eventTitle.en", fromManifest.EventTitle.En, toManifest.EventTitle.En, "cosmetic");
        Add("eventTitle.zh", fromManifest.EventTitle.Zh, toManifest.EventTitle.Zh, "cosmetic");
        Add("startUtc", fromManifest.StartUtc.ToString("O"), toManifest.StartUtc.ToString("O"), "governanceCritical");
        Add("endUtc", fromManifest.EndUtc.ToString("O"), toManifest.EndUtc.ToString("O"), "governanceCritical");
        Add("eventPlanVersion", from.EventPlanVersion.ToString(), to.EventPlanVersion.ToString(), "governanceCritical");
        Add("governancePolicyVersion", from.GovernancePolicyVersion, to.GovernancePolicyVersion, "governanceCritical");
        Add("governanceTier", from.GovernanceTier.ToString(), to.GovernanceTier.ToString(), "governanceCritical");
        Add("scope", $"{from.ScopeType}:{from.ScopeId}", $"{to.ScopeType}:{to.ScopeId}", "governanceCritical");
        Add("coveredOccurrenceIds", string.Join(',', fromManifest.CoveredOccurrenceIds.Order()),
            string.Join(',', toManifest.CoveredOccurrenceIds.Order()), "governanceCritical");

        var fromModules = fromManifest.Modules.ToDictionary(x => x.ModuleCode, StringComparer.Ordinal);
        var toModules = toManifest.Modules.ToDictionary(x => x.ModuleCode, StringComparer.Ordinal);
        foreach (var moduleCode in fromModules.Keys.Union(toModules.Keys, StringComparer.Ordinal).Order(StringComparer.Ordinal))
        {
            fromModules.TryGetValue(moduleCode, out var before);
            toModules.TryGetValue(moduleCode, out var after);
            var planClassification = IsSafetyCriticalModule(moduleCode) ? "governanceCritical" : "operational";
            Add($"modules.{moduleCode}.planStatus", before?.PlanStatus, after?.PlanStatus,
                planClassification, [moduleCode]);
            Add($"modules.{moduleCode}.sourceVersion", before?.SourceVersion, after?.SourceVersion,
                "governanceCritical", [moduleCode]);
            Add($"modules.{moduleCode}.availability", before?.Availability, after?.Availability,
                planClassification, [moduleCode]);
        }

        var fromSources = from.SourceReferences.ToDictionary(SourceKey, x => x, StringComparer.Ordinal);
        var toSources = to.SourceReferences.ToDictionary(SourceKey, x => x, StringComparer.Ordinal);
        foreach (var sourceKey in fromSources.Keys.Union(toSources.Keys, StringComparer.Ordinal).Order(StringComparer.Ordinal))
        {
            fromSources.TryGetValue(sourceKey, out var before);
            toSources.TryGetValue(sourceKey, out var after);
            var moduleCode = before?.ModuleCode ?? after!.ModuleCode;
            Add($"sources.{sourceKey}.version", before?.SubjectVersion, after?.SubjectVersion,
                "governanceCritical", [moduleCode]);
        }
        return changes;

        void Add(string field, string? before, string? after, string classification,
            IReadOnlyList<string>? affectedModules = null)
        {
            if (!string.Equals(before, after, StringComparison.Ordinal))
                changes.Add(new(field, before, after, classification, affectedModules ?? []));
        }
    }

    private static string SourceKey(EventPackageSourceReference source)
        => $"{source.ModuleCode}:{source.SubjectType}:{source.SubjectId:N}";

    private static bool IsSafetyCriticalModule(string moduleCode)
        => moduleCode is "SAFETY.RAM" or "SAFEGUARDING.CHILD" or "MONEY.FINANCE" or "MOVE.STAY";

    private static string ETag(EventPackage package) => $"\"package-{package.Version}-{package.ConcurrencyToken:N}\"";
    private static string LifecycleETag(GroupEvent groupEvent) => $"\"event-publication-{groupEvent.PublicationConcurrencyToken:N}\"";
    private static string RegistrationETag(GroupEvent groupEvent) => $"\"event-registration-{groupEvent.RegistrationConcurrencyToken:N}\"";
    private static string ExecutionETag(GroupEvent groupEvent) => $"\"event-execution-{groupEvent.ExecutionConcurrencyToken:N}\"";
    private static string ExecutionETag(EventOccurrence occurrence) => $"\"occurrence-execution-{occurrence.ExecutionConcurrencyToken:N}\"";
    private static string ConditionETag(EventPackageCondition condition) => $"\"condition-{condition.ConcurrencyToken:N}\"";
    private static bool Matches(string? supplied, string expected) => string.Equals(supplied?.Trim(), expected, StringComparison.Ordinal);
    private static string? ValidateIdempotencyKey(string? key) => string.IsNullOrWhiteSpace(key) || key.Trim().Length > 120
        ? "Idempotency-Key is required and must be at most 120 characters." : null;
    private static DateTime AsUtc(DateTime value) => value.Kind == DateTimeKind.Utc ? value : DateTime.SpecifyKind(value, DateTimeKind.Utc);
    private static DateTime? ResolveApprovalExpiry(string rulesJson, EventGovernanceTier tier, DateTime effectiveUtc)
    {
        try
        {
            using var document = JsonDocument.Parse(rulesJson);
            if (!document.RootElement.TryGetProperty("approvalValidityByTier", out var validity) ||
                !validity.TryGetProperty(tier.ToString().ToLowerInvariant(), out var durationElement) ||
                durationElement.ValueKind != JsonValueKind.String)
                return null;
            var duration = System.Xml.XmlConvert.ToTimeSpan(durationElement.GetString()!);
            return duration > TimeSpan.Zero ? effectiveUtc.Add(duration) : null;
        }
        catch (Exception exception) when (exception is JsonException or FormatException or OverflowException)
        {
            return null;
        }
    }
    private static int? ResolveMinimumApproverCount(string rulesJson, EventGovernanceTier tier)
    {
        try
        {
            using var document = JsonDocument.Parse(rulesJson);
            return document.RootElement.GetProperty("authorityByTier")
                .GetProperty(tier.ToString().ToLowerInvariant()).GetProperty("minimumApproverCount").GetInt32() is var count && count is >= 1 and <= 5
                ? count : null;
        }
        catch (Exception exception) when (exception is JsonException or InvalidOperationException or KeyNotFoundException) { return null; }
    }
    private static bool ReadConditionWaiverAllowed(string rulesJson)
    {
        try
        {
            using var document = JsonDocument.Parse(rulesJson);
            return document.RootElement.TryGetProperty("conditionWaiverAllowed", out var value) &&
                value.ValueKind == JsonValueKind.True;
        }
        catch (JsonException) { return false; }
    }
    private static int? ReadMinimumApproverCount(string authoritySnapshotJson)
    {
        try
        {
            using var document = JsonDocument.Parse(authoritySnapshotJson);
            return document.RootElement.TryGetProperty("minimumApproverCount", out var value) && value.TryGetInt32(out var count)
                ? count : null;
        }
        catch (JsonException) { return null; }
    }
    private static string DataClass(string moduleCode) => moduleCode switch
    {
        "TEAM.WORK" or "PROGRAM.PRODUCTION" or "PLACE.RESOURCE" => "eventTeam",
        "PEOPLE.REGISTRATION" or "MOVE.STAY" => "userSpecific",
        "SAFETY.RAM" or "SAFEGUARDING.CHILD" or "MONEY.FINANCE" or "FESTIVAL.OPERATIONS" => "approvalEvidence",
        _ => "churchOrGroupVisible"
    };
    private static AppResult<TOut> Failure<TOut, TIn>(AppResult<TIn> result) => result.Status switch
    {
        AppResultStatus.NotFound => AppResult<TOut>.NotFound(result.Message!),
        AppResultStatus.Forbidden => AppResult<TOut>.Forbidden(result.Message!),
        AppResultStatus.ValidationError => AppResult<TOut>.Validation(result.Message!),
        AppResultStatus.PreconditionFailed => AppResult<TOut>.PreconditionFailed(result.Message!),
        _ => AppResult<TOut>.Conflict(result.Message ?? "Event Package operation failed.")
    };

    private sealed record PolicyRules(string SchemaVersion, PolicyTierRule[] TierRules,
        Dictionary<string, PolicyAuthorityRule> AuthorityByTier, LegacyRolloutRule LegacyRollout,
        int PreEventConfirmationWindowHours);
    private sealed record PolicyAuthorityRule(int MinimumApproverCount);
    private sealed record PolicyTierRule(EventGovernanceTier Tier, string[] WhenAnyConfirmedFactCodes,
        string[] WhenAnyActivityTypeCodes, string[] WhenAnyModuleCodes);
    private sealed record LegacyRolloutRule(DateTime EffectiveFromUtc, DateTime TransitionDeadlineUtc,
        string CohortRule, string[] SafetyCriticalModuleCodes,
        Dictionary<string, LegacyEventPackageTransition> TransitionByMode);
    private sealed record ScopeCapture(EventPackageCoverageMode CoverageMode, IReadOnlyList<Guid> CoveredOccurrenceIds);
    private sealed record SourceCapture(string ModuleCode, string SubjectType, Guid SubjectId, string SubjectVersion,
        Guid? SourceDecisionId, DateTime? ValidUntilUtc, string DataClass, bool RequiredForDecision);
    private sealed record PackageCapture(EventPlanSnapshotDto Plan, EventPackageGovernancePolicyVersion Policy,
        EventPackageManifestDto Manifest, IReadOnlyList<SourceCapture> Sources, string SourceVectorHash);
    private sealed record DecisionAuthority(bool Allowed, string? AuthorityCode, Guid? AuthorityGroupId, string? DenialReason)
    {
        public static DecisionAuthority Allow(string code, Guid? groupId) => new(true, code, groupId, null);
        public static DecisionAuthority Deny(string reason) => new(false, null, null, reason);
    }
}
