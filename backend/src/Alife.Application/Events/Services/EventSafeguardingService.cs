using System.Text.Json;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Services;

public sealed class EventSafeguardingService(
    IAlifeDbContext db,
    IGroupAuthorizationService authorization) : IEventSafeguardingService
{
    public const string ModuleCode = "SAFEGUARDING.CHILD";
    public const string Classification = "roleRestricted";

    public async Task<AppResult<EventSafeguardingWorkspaceDto>> GetWorkspaceAsync(Guid eventId, Guid? occurrenceId, Guid memberId, CancellationToken ct)
    {
        var groupEvent = await FindEvent(eventId, ct);
        if (groupEvent is null) return AppResult<EventSafeguardingWorkspaceDto>.NotFound("Event not found.");
        if (!await IsModuleEnabled(eventId, ct)) return AppResult<EventSafeguardingWorkspaceDto>.Conflict("SAFEGUARDING.CHILD is not enabled by the accepted plan.");
        var isLead = await IsLead(eventId, memberId, ct);
        if (!isLead)
        {
            occurrenceId ??= await ResolveDutyOccurrence(eventId, memberId, ct);
            if (!occurrenceId.HasValue || !await CanPerformCheckInDuty(eventId, occurrenceId.Value, memberId, ct))
                return AppResult<EventSafeguardingWorkspaceDto>.Forbidden("Safeguarding lead or eligible check-in worker access is required.");
        }
        if (occurrenceId.HasValue && !await db.EventOccurrences.AsNoTracking().AnyAsync(x => x.Id == occurrenceId && x.EventId == eventId, ct))
            return AppResult<EventSafeguardingWorkspaceDto>.NotFound("Event occurrence not found.");
        return AppResult<EventSafeguardingWorkspaceDto>.Success(await BuildWorkspace(groupEvent, occurrenceId, isLead, ct));
    }

    public async Task<AppResult<EventSafeguardingMyContextDto>> GetMyContextAsync(Guid eventId, Guid memberId, CancellationToken ct)
    {
        if (!await db.GroupEvents.AsNoTracking().AnyAsync(x => x.Id == eventId, ct))
            return AppResult<EventSafeguardingMyContextDto>.NotFound("Event not found.");
        if (!await IsModuleEnabled(eventId, ct))
            return AppResult<EventSafeguardingMyContextDto>.Conflict("SAFEGUARDING.CHILD is not enabled by the accepted plan.");
        var related = await ChildQuery(eventId).AsNoTracking()
            .Where(x => x.ChildMemberId == memberId || x.Guardians.Any(g => g.GuardianMemberId == memberId && g.Status != EventGuardianRelationshipStatus.Ended))
            .OrderBy(x => x.ChildMember.DisplayName).ToListAsync(ct);
        if (related.Count == 0) return AppResult<EventSafeguardingMyContextDto>.Forbidden("No child or guardian context is available for this event.");
        var configuration = await db.EventSafeguardingConfigurations.AsNoTracking().FirstOrDefaultAsync(x => x.EventId == eventId, ct);
        return AppResult<EventSafeguardingMyContextDto>.Success(ToMyContext(eventId, memberId, configuration?.PolicyVersionId, related));
    }

    public async Task<AppResult<EventSafeguardingWorkspaceDto>> ConfigurePolicyAsync(Guid eventId, Guid memberId, ConfigureEventSafeguardingRequest request, string ifMatch, string idempotencyKey, CancellationToken ct)
    {
        var access = await RequireLead(eventId, memberId, ct);
        if (!access.IsSuccess) return Failure<EventSafeguardingWorkspaceDto, GroupEvent>(access);
        var retry = await BeginIdempotent("safeguarding.policy.configure", eventId, memberId, request, idempotencyKey, ct);
        if (!retry.IsSuccess) return Failure<EventSafeguardingWorkspaceDto, EventIdempotencyRecord?>(retry);
        if (retry.Value is not null) return AppResult<EventSafeguardingWorkspaceDto>.Success(await BuildWorkspace(access.Value!, null, true, ct));
        var policy = await db.EventSafeguardingPolicyVersions.FirstOrDefaultAsync(x => x.Id == request.PolicyVersionId, ct);
        if (policy is null || !await IsApplicablePolicy(access.Value!, policy, ct))
            return AppResult<EventSafeguardingWorkspaceDto>.Validation("The selected published policy is not applicable to this event.");
        if (EventSafeguardingReadiness.ParsePolicy(policy.RequirementsJson) is null)
            return AppResult<EventSafeguardingWorkspaceDto>.Validation("The selected policy contains unknown or unsupported requirement values.");
        var configuration = await db.EventSafeguardingConfigurations.FirstOrDefaultAsync(x => x.EventId == eventId, ct);
        if (configuration is not null && !Matches(ifMatch, ConfigurationETag(configuration)))
            return AppResult<EventSafeguardingWorkspaceDto>.PreconditionFailed("The safeguarding configuration changed; reload before selecting a policy.");
        var now = DateTime.UtcNow;
        if (configuration is null)
        {
            if (!Matches(ifMatch, EmptyConfigurationETag(eventId)))
                return AppResult<EventSafeguardingWorkspaceDto>.PreconditionFailed("Reload safeguarding before selecting the first policy.");
            configuration = new() { Id = Guid.NewGuid(), EventId = eventId, PolicyVersionId = policy.Id,
                ConfiguredByMemberId = memberId, ConfiguredUtc = now };
            db.EventSafeguardingConfigurations.Add(configuration);
        }
        else
        {
            configuration.PolicyVersionId = policy.Id; configuration.ConfiguredByMemberId = memberId;
            configuration.ConfiguredUtc = now; configuration.ConcurrencyToken = Guid.NewGuid();
        }
        AddAudit("safeguarding.policy.configure", access.Value!, memberId, null, now);
        db.EventIdempotencyRecords.Add(NewIdempotency("safeguarding.policy.configure", eventId, idempotencyKey, memberId, request, configuration.Id, now));
        return await SaveWorkspace(access.Value!, null, true, "The safeguarding policy changed concurrently; reload and try again.", ct);
    }

    public async Task<AppResult<EventSafeguardingWorkspaceDto>> RegisterChildAsync(Guid eventId, Guid memberId, CreateEventChildRegistrationRequest request, string idempotencyKey, CancellationToken ct)
    {
        var access = await RequireLead(eventId, memberId, ct);
        if (!access.IsSuccess) return Failure<EventSafeguardingWorkspaceDto, GroupEvent>(access);
        if (request.PhotoUrl?.Length > 1200) return AppResult<EventSafeguardingWorkspaceDto>.Validation("Photo URL is too long.");
        if (!await HasRecognizedPolicy(eventId, ct)) return AppResult<EventSafeguardingWorkspaceDto>.Conflict("A recognized versioned safeguarding policy must be loaded first.");
        var enrollment = await db.EventEnrollments.AsNoTracking().FirstOrDefaultAsync(x => x.Id == request.EnrollmentId && x.EventId == eventId, ct);
        if (enrollment is null) return AppResult<EventSafeguardingWorkspaceDto>.Validation("Child registration must reference an existing enrollment for this event.");
        var retry = await BeginIdempotent("safeguarding.child.register", eventId, memberId, request, idempotencyKey, ct);
        if (!retry.IsSuccess) return Failure<EventSafeguardingWorkspaceDto, EventIdempotencyRecord?>(retry);
        if (retry.Value is not null) return AppResult<EventSafeguardingWorkspaceDto>.Success(await BuildWorkspace(access.Value!, null, true, ct));
        if (await db.EventChildRegistrations.AsNoTracking().AnyAsync(x => x.EventId == eventId && (x.EnrollmentId == enrollment.Id || x.ChildMemberId == enrollment.MemberId) && x.IsActive, ct))
            return AppResult<EventSafeguardingWorkspaceDto>.Conflict("This enrollment already has an active child safeguarding registration.");
        var now = DateTime.UtcNow;
        var child = new EventChildRegistration { Id = Guid.NewGuid(), EventId = eventId, EnrollmentId = enrollment.Id,
            ChildMemberId = enrollment.MemberId, PhotoUrl = Normalize(request.PhotoUrl), CreatedByMemberId = memberId,
            CreatedUtc = now };
        db.EventChildRegistrations.Add(child);
        AddAudit("safeguarding.child.register", access.Value!, memberId, child.Id, now);
        db.EventIdempotencyRecords.Add(NewIdempotency("safeguarding.child.register", eventId, idempotencyKey, memberId, request, child.Id, now));
        return await SaveWorkspace(access.Value!, null, true, "The child registration changed concurrently; reload and try again.", ct);
    }

    public async Task<AppResult<EventSafeguardingWorkspaceDto>> AddGuardianAsync(Guid eventId, Guid childId, Guid memberId, CreateEventChildGuardianRequest request, string ifMatch, string idempotencyKey, CancellationToken ct)
    {
        var access = await RequireLead(eventId, memberId, ct);
        if (!access.IsSuccess) return Failure<EventSafeguardingWorkspaceDto, GroupEvent>(access);
        if (string.IsNullOrWhiteSpace(request.RelationshipLabel) || request.RelationshipLabel.Trim().Length > 120)
            return AppResult<EventSafeguardingWorkspaceDto>.Validation("A relationship label up to 120 characters is required.");
        var child = await db.EventChildRegistrations.FirstOrDefaultAsync(x => x.Id == childId && x.EventId == eventId && x.IsActive, ct);
        if (child is null) return AppResult<EventSafeguardingWorkspaceDto>.NotFound("Child registration not found.");
        var retry = await BeginIdempotent("safeguarding.guardian.create", childId, memberId, request, idempotencyKey, ct);
        if (!retry.IsSuccess) return Failure<EventSafeguardingWorkspaceDto, EventIdempotencyRecord?>(retry);
        if (retry.Value is not null) return AppResult<EventSafeguardingWorkspaceDto>.Success(await BuildWorkspace(access.Value!, null, true, ct));
        if (!Matches(ifMatch, ChildETag(child))) return AppResult<EventSafeguardingWorkspaceDto>.PreconditionFailed("The child record changed; reload before adding a guardian.");
        if (request.GuardianMemberId == child.ChildMemberId) return AppResult<EventSafeguardingWorkspaceDto>.Validation("A child registration cannot be its own guardian relationship.");
        if (!await IsEventMember(access.Value!, request.GuardianMemberId, ct))
            return AppResult<EventSafeguardingWorkspaceDto>.Validation("The guardian must be an approved group member or event enrollee.");
        if (await db.EventChildGuardianRelationships.AsNoTracking().AnyAsync(x => x.ChildRegistrationId == childId &&
            x.GuardianMemberId == request.GuardianMemberId && x.Status != EventGuardianRelationshipStatus.Ended, ct))
            return AppResult<EventSafeguardingWorkspaceDto>.Conflict("This guardian relationship already exists.");
        var now = DateTime.UtcNow;
        var relationship = new EventChildGuardianRelationship { Id = Guid.NewGuid(), ChildRegistrationId = childId,
            GuardianMemberId = request.GuardianMemberId, RelationshipLabel = request.RelationshipLabel.Trim(),
            CreatedByMemberId = memberId, CreatedUtc = now };
        child.ConcurrencyToken = Guid.NewGuid();
        db.EventChildGuardianRelationships.Add(relationship);
        AddAudit("safeguarding.guardian.create", access.Value!, memberId, child.Id, now);
        db.EventIdempotencyRecords.Add(NewIdempotency("safeguarding.guardian.create", childId, idempotencyKey, memberId, request, relationship.Id, now));
        return await SaveWorkspace(access.Value!, null, true, "The guardian relationship changed concurrently; reload and try again.", ct);
    }

    public async Task<AppResult<EventSafeguardingMyContextDto>> ConfirmGuardianAsync(Guid eventId, Guid relationshipId, Guid memberId, string ifMatch, string idempotencyKey, CancellationToken ct)
    {
        var relationship = await GuardianQuery(eventId).FirstOrDefaultAsync(x => x.Id == relationshipId && x.GuardianMemberId == memberId, ct);
        if (relationship is null) return AppResult<EventSafeguardingMyContextDto>.NotFound("Guardian relationship not found.");
        var request = new { relationshipId };
        var retry = await BeginIdempotent("safeguarding.guardian.confirm", relationshipId, memberId, request, idempotencyKey, ct);
        if (!retry.IsSuccess) return Failure<EventSafeguardingMyContextDto, EventIdempotencyRecord?>(retry);
        if (retry.Value is not null) return await GetMyContextAsync(eventId, memberId, ct);
        if (!Matches(ifMatch, GuardianETag(relationship))) return AppResult<EventSafeguardingMyContextDto>.PreconditionFailed("The guardian relationship changed; reload before confirming it.");
        if (relationship.Status != EventGuardianRelationshipStatus.Pending)
            return AppResult<EventSafeguardingMyContextDto>.Conflict("Only a pending guardian relationship can be confirmed.");
        var now = DateTime.UtcNow;
        relationship.Status = EventGuardianRelationshipStatus.Confirmed; relationship.ConfirmedUtc = now;
        relationship.ConcurrencyToken = Guid.NewGuid();
        AddAudit("safeguarding.guardian.confirm", relationship.ChildRegistration.Event, memberId,
            relationship.ChildRegistrationId, now);
        db.EventIdempotencyRecords.Add(NewIdempotency("safeguarding.guardian.confirm", relationshipId, idempotencyKey, memberId, request, relationship.Id, now));
        return await SaveMyContext(eventId, memberId, "The guardian relationship changed concurrently; reload and try again.", ct);
    }

    public async Task<AppResult<EventSafeguardingMyContextDto>> RecordConsentAsync(Guid eventId, Guid relationshipId, Guid memberId, RecordEventChildConsentRequest request, string ifMatch, string idempotencyKey, CancellationToken ct)
    {
        var relationship = await GuardianQuery(eventId).FirstOrDefaultAsync(x => x.Id == relationshipId && x.GuardianMemberId == memberId, ct);
        if (relationship is null) return AppResult<EventSafeguardingMyContextDto>.NotFound("Guardian relationship not found.");
        var retry = await BeginIdempotent("safeguarding.consent.record", relationshipId, memberId, request, idempotencyKey, ct);
        if (!retry.IsSuccess) return Failure<EventSafeguardingMyContextDto, EventIdempotencyRecord?>(retry);
        if (retry.Value is not null) return await GetMyContextAsync(eventId, memberId, ct);
        if (relationship.Status != EventGuardianRelationshipStatus.Confirmed)
            return AppResult<EventSafeguardingMyContextDto>.Conflict("Confirm the guardian relationship before recording consent.");
        if (!Matches(ifMatch, GuardianETag(relationship))) return AppResult<EventSafeguardingMyContextDto>.PreconditionFailed("The guardian relationship changed; reload before recording consent.");
        var configuration = await db.EventSafeguardingConfigurations.Include(x => x.PolicyVersion).FirstOrDefaultAsync(x => x.EventId == eventId, ct);
        if (configuration is null || EventSafeguardingReadiness.ParsePolicy(configuration.PolicyVersion.RequirementsJson) is null)
            return AppResult<EventSafeguardingMyContextDto>.Conflict("A recognized versioned safeguarding policy must be loaded first.");
        var latest = await db.EventChildConsentRecords.AsNoTracking().Where(x => x.GuardianRelationshipId == relationshipId && x.PolicyVersionId == configuration.PolicyVersionId)
            .OrderByDescending(x => x.RecordedUtc).FirstOrDefaultAsync(ct);
        if (latest?.Decision == request.Decision) return AppResult<EventSafeguardingMyContextDto>.Conflict("This consent decision is already current.");
        var now = DateTime.UtcNow;
        var record = new EventChildConsentRecord { Id = Guid.NewGuid(), ChildRegistrationId = relationship.ChildRegistrationId,
            GuardianRelationshipId = relationship.Id, PolicyVersionId = configuration.PolicyVersionId,
            Decision = request.Decision, RecordedByMemberId = memberId, RecordedUtc = now };
        db.EventChildConsentRecords.Add(record);
        relationship.ConcurrencyToken = Guid.NewGuid();
        AddAudit(request.Decision == EventGuardianConsentDecision.Granted ? "safeguarding.consent.grant" : "safeguarding.consent.withdraw",
            relationship.ChildRegistration.Event, memberId, relationship.ChildRegistrationId, now);
        db.EventIdempotencyRecords.Add(NewIdempotency("safeguarding.consent.record", relationshipId, idempotencyKey, memberId, request, record.Id, now));
        return await SaveMyContext(eventId, memberId, "Consent changed concurrently; reload and try again.", ct);
    }

    public async Task<AppResult<EventSafeguardingMyContextDto>> AddCollectorAsync(Guid eventId, Guid childId, Guid memberId, CreateEventChildCollectorRequest request, string idempotencyKey, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.DisplayName) || request.DisplayName.Trim().Length > 200 ||
            string.IsNullOrWhiteSpace(request.RelationshipLabel) || request.RelationshipLabel.Trim().Length > 120)
            return AppResult<EventSafeguardingMyContextDto>.Validation("Collector name and relationship are required within their length limits.");
        var relationship = await GuardianQuery(eventId).Where(x => x.ChildRegistrationId == childId && x.GuardianMemberId == memberId &&
            x.Status == EventGuardianRelationshipStatus.Confirmed).OrderByDescending(x => x.ConfirmedUtc).FirstOrDefaultAsync(ct);
        if (relationship is null) return AppResult<EventSafeguardingMyContextDto>.Forbidden("A confirmed guardian may authorise collectors for this child.");
        var retry = await BeginIdempotent("safeguarding.collector.authorize", childId, memberId, request, idempotencyKey, ct);
        if (!retry.IsSuccess) return Failure<EventSafeguardingMyContextDto, EventIdempotencyRecord?>(retry);
        if (retry.Value is not null) return await GetMyContextAsync(eventId, memberId, ct);
        var now = DateTime.UtcNow;
        var collector = new EventChildAuthorisedCollector { Id = Guid.NewGuid(), ChildRegistrationId = childId,
            AuthorisedByGuardianRelationshipId = relationship.Id, DisplayName = request.DisplayName.Trim(),
            RelationshipLabel = request.RelationshipLabel.Trim(), AuthorisedUtc = now };
        db.EventChildAuthorisedCollectors.Add(collector);
        AddAudit("safeguarding.collector.authorize", relationship.ChildRegistration.Event, memberId, childId, now);
        db.EventIdempotencyRecords.Add(NewIdempotency("safeguarding.collector.authorize", childId, idempotencyKey, memberId, request, collector.Id, now));
        return await SaveMyContext(eventId, memberId, "Collector authority changed concurrently; reload and try again.", ct);
    }

    public async Task<AppResult<EventSafeguardingMyContextDto>> RevokeCollectorAsync(Guid eventId, Guid collectorId, Guid memberId, string ifMatch, string idempotencyKey, CancellationToken ct)
    {
        var collector = await db.EventChildAuthorisedCollectors.Include(x => x.ChildRegistration).ThenInclude(x => x.Event)
            .Include(x => x.AuthorisedByGuardianRelationship).FirstOrDefaultAsync(x => x.Id == collectorId &&
                x.ChildRegistration.EventId == eventId && x.AuthorisedByGuardianRelationship.GuardianMemberId == memberId, ct);
        if (collector is null) return AppResult<EventSafeguardingMyContextDto>.NotFound("Authorised collector not found.");
        var request = new { collectorId };
        var retry = await BeginIdempotent("safeguarding.collector.revoke", collectorId, memberId, request, idempotencyKey, ct);
        if (!retry.IsSuccess) return Failure<EventSafeguardingMyContextDto, EventIdempotencyRecord?>(retry);
        if (retry.Value is not null) return await GetMyContextAsync(eventId, memberId, ct);
        if (!Matches(ifMatch, CollectorETag(collector))) return AppResult<EventSafeguardingMyContextDto>.PreconditionFailed("Collector authority changed; reload before revoking it.");
        if (!collector.IsActive) return AppResult<EventSafeguardingMyContextDto>.Conflict("Collector authority is already revoked.");
        var now = DateTime.UtcNow;
        collector.IsActive = false; collector.RevokedByMemberId = memberId; collector.RevokedUtc = now;
        collector.ConcurrencyToken = Guid.NewGuid();
        AddAudit("safeguarding.collector.revoke", collector.ChildRegistration.Event, memberId,
            collector.ChildRegistrationId, now);
        db.EventIdempotencyRecords.Add(NewIdempotency("safeguarding.collector.revoke", collectorId, idempotencyKey, memberId, request, collector.Id, now));
        return await SaveMyContext(eventId, memberId, "Collector authority changed concurrently; reload and try again.", ct);
    }

    public async Task<AppResult<EventSafeguardingWorkspaceDto>> SaveWorkerEvidenceAsync(Guid eventId, Guid memberId, SaveEventSafeguardingWorkerEvidenceRequest request, string idempotencyKey, CancellationToken ct)
    {
        var access = await RequireLead(eventId, memberId, ct);
        if (!access.IsSuccess) return Failure<EventSafeguardingWorkspaceDto, GroupEvent>(access);
        if (string.IsNullOrWhiteSpace(request.EvidenceReference) || request.EvidenceReference.Trim().Length > 300)
            return AppResult<EventSafeguardingWorkspaceDto>.Validation("A non-sensitive eligibility evidence reference is required.");
        var configuration = await db.EventSafeguardingConfigurations.Include(x => x.PolicyVersion).FirstOrDefaultAsync(x => x.EventId == eventId, ct);
        var requirements = configuration is null ? null : EventSafeguardingReadiness.ParsePolicy(configuration.PolicyVersion.RequirementsJson);
        var requirement = requirements?.WorkerRequirements?.FirstOrDefault(x => x.RoleRequirementKey == request.RoleRequirementKey &&
            x.EligibilityEvidenceCode == request.EligibilityEvidenceCode);
        if (requirement is null) return AppResult<EventSafeguardingWorkspaceDto>.Validation("Worker evidence must match an exact requirement in the selected policy version.");
        if (!await db.EventRoleAssignments.AsNoTracking().AnyAsync(x => x.EventId == eventId && x.MemberId == request.MemberId &&
            x.RoleRequirementKey == request.RoleRequirementKey && x.Status == EventRoleAssignmentStatus.Accepted && x.EndedUtc == null, ct))
            return AppResult<EventSafeguardingWorkspaceDto>.Validation("Worker eligibility evidence requires an accepted matching event role.");
        var retry = await BeginIdempotent("safeguarding.worker-evidence.save", eventId, memberId, request, idempotencyKey, ct);
        if (!retry.IsSuccess) return Failure<EventSafeguardingWorkspaceDto, EventIdempotencyRecord?>(retry);
        if (retry.Value is not null) return AppResult<EventSafeguardingWorkspaceDto>.Success(await BuildWorkspace(access.Value!, null, true, ct));
        var now = DateTime.UtcNow;
        var evidence = await db.EventSafeguardingWorkerEligibility.FirstOrDefaultAsync(x => x.EventId == eventId &&
            x.PolicyVersionId == configuration!.PolicyVersionId && x.MemberId == request.MemberId &&
            x.RoleRequirementKey == request.RoleRequirementKey && x.EligibilityEvidenceCode == request.EligibilityEvidenceCode, ct);
        if (evidence is null)
        {
            evidence = new() { Id = Guid.NewGuid(), EventId = eventId, PolicyVersionId = configuration!.PolicyVersionId,
                MemberId = request.MemberId, RoleRequirementKey = request.RoleRequirementKey,
                EligibilityEvidenceCode = request.EligibilityEvidenceCode };
            db.EventSafeguardingWorkerEligibility.Add(evidence);
        }
        evidence.EvidenceReference = request.EvidenceReference.Trim(); evidence.IsEligible = request.IsEligible;
        evidence.VerifiedByMemberId = memberId; evidence.VerifiedUtc = now; evidence.ConcurrencyToken = Guid.NewGuid();
        AddAudit("safeguarding.worker-evidence.save", access.Value!, memberId, null, now);
        db.EventIdempotencyRecords.Add(NewIdempotency("safeguarding.worker-evidence.save", eventId, idempotencyKey, memberId, request, evidence.Id, now));
        return await SaveWorkspace(access.Value!, null, true, "Worker eligibility evidence changed concurrently; reload and try again.", ct);
    }

    public async Task<AppResult<EventSafeguardingWorkspaceDto>> CheckInAsync(Guid eventId, Guid occurrenceId, Guid childId, Guid memberId, string ifMatch, string idempotencyKey, CancellationToken ct)
    {
        var duty = await RequireDuty(eventId, occurrenceId, memberId, ct);
        if (!duty.IsSuccess) return Failure<EventSafeguardingWorkspaceDto, GroupEvent>(duty);
        var child = await ChildQuery(eventId).FirstOrDefaultAsync(x => x.Id == childId && x.IsActive, ct);
        if (child is null) return AppResult<EventSafeguardingWorkspaceDto>.NotFound("Child registration not found.");
        var retry = await BeginIdempotent("safeguarding.occurrence.check-in", occurrenceId, memberId, new { childId }, idempotencyKey, ct);
        if (!retry.IsSuccess) return Failure<EventSafeguardingWorkspaceDto, EventIdempotencyRecord?>(retry);
        if (retry.Value is not null) return AppResult<EventSafeguardingWorkspaceDto>.Success(await BuildWorkspace(duty.Value!, occurrenceId, await IsLead(eventId, memberId, ct), ct));
        if (!Matches(ifMatch, ChildETag(child))) return AppResult<EventSafeguardingWorkspaceDto>.PreconditionFailed("The child record changed; reload before check-in.");
        var configuration = await db.EventSafeguardingConfigurations.Include(x => x.PolicyVersion).FirstOrDefaultAsync(x => x.EventId == eventId, ct);
        var roles = await db.EventRoleAssignments.AsNoTracking().Where(x => x.EventId == eventId).ToListAsync(ct);
        var workerEvidence = await db.EventSafeguardingWorkerEligibility.AsNoTracking().Where(x => x.EventId == eventId).ToListAsync(ct);
        var now = DateTime.UtcNow;
        var childReadiness = EventSafeguardingReadiness.Evaluate(configuration, [child], roles, workerEvidence, now);
        var activeChildren = await ChildQuery(eventId).AsNoTracking().Where(x => x.IsActive).ToListAsync(ct);
        var eventWorkerReadiness = EventSafeguardingReadiness.Evaluate(configuration, activeChildren, roles, workerEvidence, now);
        if (!childReadiness.CurrentPolicyLoaded || !childReadiness.GuardianshipComplete || !eventWorkerReadiness.EligibleWorkersSatisfied)
            return AppResult<EventSafeguardingWorkspaceDto>.Conflict("Check-in is blocked until policy, guardian consent, authorised collection and eligible worker requirements are complete.");
        if (await db.EventChildAttendanceRecords.AsNoTracking().AnyAsync(x => x.EventOccurrenceId == occurrenceId && x.ChildRegistrationId == childId, ct))
            return AppResult<EventSafeguardingWorkspaceDto>.Conflict("This child has already been checked in for the occurrence; checked-out records cannot be silently reopened.");
        var attendance = new EventChildAttendance { Id = Guid.NewGuid(), EventId = eventId, EventOccurrenceId = occurrenceId,
            ChildRegistrationId = childId, CheckedInByMemberId = memberId, CheckedInUtc = now };
        child.ConcurrencyToken = Guid.NewGuid();
        db.EventChildAttendanceRecords.Add(attendance);
        AddAudit("safeguarding.occurrence.check-in", duty.Value!, memberId, childId, now);
        db.EventIdempotencyRecords.Add(NewIdempotency("safeguarding.occurrence.check-in", occurrenceId, idempotencyKey, memberId, new { childId }, attendance.Id, now));
        return await SaveWorkspace(duty.Value!, occurrenceId, await IsLead(eventId, memberId, ct), "Check-in changed concurrently; reload and try again.", ct);
    }

    public async Task<AppResult<EventSafeguardingWorkspaceDto>> CheckOutAsync(Guid eventId, Guid occurrenceId, Guid childId, Guid memberId, CheckOutEventChildRequest request, string ifMatch, string idempotencyKey, CancellationToken ct)
    {
        var duty = await RequireDuty(eventId, occurrenceId, memberId, ct);
        if (!duty.IsSuccess) return Failure<EventSafeguardingWorkspaceDto, GroupEvent>(duty);
        var attendance = await db.EventChildAttendanceRecords.Include(x => x.ChildRegistration).Include(x => x.Collector)
            .FirstOrDefaultAsync(x => x.EventId == eventId && x.EventOccurrenceId == occurrenceId && x.ChildRegistrationId == childId, ct);
        if (attendance is null) return AppResult<EventSafeguardingWorkspaceDto>.Conflict("The child is not checked in for this occurrence.");
        var retry = await BeginIdempotent("safeguarding.occurrence.check-out", occurrenceId, memberId, request, idempotencyKey, ct);
        if (!retry.IsSuccess) return Failure<EventSafeguardingWorkspaceDto, EventIdempotencyRecord?>(retry);
        if (retry.Value is not null) return AppResult<EventSafeguardingWorkspaceDto>.Success(await BuildWorkspace(duty.Value!, occurrenceId, await IsLead(eventId, memberId, ct), ct));
        if (!Matches(ifMatch, AttendanceETag(attendance))) return AppResult<EventSafeguardingWorkspaceDto>.PreconditionFailed("Attendance changed; reload before check-out.");
        if (attendance.State != EventChildAttendanceState.Present)
            return AppResult<EventSafeguardingWorkspaceDto>.Conflict("This child is already checked out.");
        var collector = await db.EventChildAuthorisedCollectors.FirstOrDefaultAsync(x => x.Id == request.CollectorId &&
            x.ChildRegistrationId == childId && x.IsActive, ct);
        if (collector is null) return AppResult<EventSafeguardingWorkspaceDto>.Conflict("The selected collector is not currently authorised for this child.");
        var now = DateTime.UtcNow;
        attendance.State = EventChildAttendanceState.CheckedOut; attendance.CheckedOutByMemberId = memberId;
        attendance.CheckedOutUtc = now; attendance.CollectorId = collector.Id; attendance.ConcurrencyToken = Guid.NewGuid();
        AddAudit("safeguarding.occurrence.check-out", duty.Value!, memberId, childId, now);
        db.EventIdempotencyRecords.Add(NewIdempotency("safeguarding.occurrence.check-out", occurrenceId, idempotencyKey, memberId, request, attendance.Id, now));
        return await SaveWorkspace(duty.Value!, occurrenceId, await IsLead(eventId, memberId, ct), "Check-out changed concurrently; reload and try again.", ct);
    }

    private async Task<EventSafeguardingWorkspaceDto> BuildWorkspace(GroupEvent groupEvent, Guid? occurrenceId, bool fullAccess, CancellationToken ct)
    {
        var occurrences = await db.EventOccurrences.AsNoTracking().Where(x => x.EventId == groupEvent.Id)
            .OrderBy(x => x.StartUtc).ToListAsync(ct);
        occurrenceId ??= occurrences.FirstOrDefault(x => x.Status == EventOccurrenceStatus.Scheduled)?.Id;
        var configuration = await db.EventSafeguardingConfigurations.AsNoTracking().Include(x => x.PolicyVersion)
            .FirstOrDefaultAsync(x => x.EventId == groupEvent.Id, ct);
        var children = await ChildQuery(groupEvent.Id).AsNoTracking().Where(x => x.IsActive)
            .OrderBy(x => x.ChildMember.DisplayName).ToListAsync(ct);
        var roles = await db.EventRoleAssignments.AsNoTracking().Where(x => x.EventId == groupEvent.Id).ToListAsync(ct);
        var workerEvidence = await db.EventSafeguardingWorkerEligibility.AsNoTracking().Where(x => x.EventId == groupEvent.Id)
            .Include(x => x.Member).OrderBy(x => x.Member.DisplayName).ToListAsync(ct);
        var now = DateTime.UtcNow;
        var readiness = EventSafeguardingReadiness.Evaluate(configuration, children, roles, workerEvidence, now);
        var policyIds = new List<Guid> { groupEvent.GroupId };
        var root = await EventCompositionPersistence.FindChurchRootIdAsync(db, groupEvent.GroupId, ct);
        if (root.HasValue && root.Value != groupEvent.GroupId) policyIds.Add(root.Value);
        var policies = fullAccess ? await db.EventSafeguardingPolicyVersions.AsNoTracking().Where(x => policyIds.Contains(x.GroupId) && x.IsPublished &&
                x.EffectiveFromUtc <= now && (!x.RetiredUtc.HasValue || x.RetiredUtc > now))
            .OrderBy(x => x.PolicyCode).ThenByDescending(x => x.Version).ToListAsync(ct) : [];
        var enrollmentOptions = fullAccess ? await db.EventEnrollments.AsNoTracking().Where(x => x.EventId == groupEvent.Id)
            .Select(x => new EventSafeguardingEnrollmentOptionDto(x.Id, x.MemberId, x.Member.DisplayName ?? string.Empty))
            .OrderBy(x => x.DisplayName).ToListAsync(ct) : [];
        var memberMap = new Dictionary<Guid, string>();
        if (fullAccess)
        {
            var groupMembers = await db.GroupMemberships.AsNoTracking().Where(x => x.GroupId == groupEvent.GroupId && x.Status == MembershipStatus.Approved)
                .Select(x => new { x.MemberId, x.Member.DisplayName }).ToListAsync(ct);
            foreach (var value in groupMembers) memberMap[value.MemberId] = value.DisplayName ?? string.Empty;
            foreach (var value in enrollmentOptions) memberMap[value.MemberId] = value.DisplayName;
        }
        var memberOptions = memberMap.OrderBy(x => x.Value).Select(x => new EventSafeguardingMemberOptionDto(x.Key, x.Value)).ToArray();
        var audit = fullAccess ? await db.AuditLogs.AsNoTracking().Where(x => x.EventId == groupEvent.Id && x.Action.StartsWith("safeguarding."))
            .OrderByDescending(x => x.OccurredUtc).Take(100)
            .Select(x => new EventSafeguardingAuditDto(x.Id, x.Action, x.EntityId, x.ActorMemberId ?? Guid.Empty, x.OccurredUtc)).ToListAsync(ct) : [];
        return new(groupEvent.Id, occurrenceId, fullAccess ? "lead" : "checkInDuty",
            configuration is null ? null : ToPolicy(configuration.PolicyVersion),
            policies.Select(ToPolicy).ToArray(),
            occurrences.Select(x => new EventOccurrenceDto(x.Id, x.EventId, x.StartUtc, x.EndUtc, x.LocalDate, x.Status, x.IsLegacyBackfill)).ToArray(),
            enrollmentOptions, memberOptions,
            children.Select(x => ToChild(x, occurrenceId, configuration?.PolicyVersionId, fullAccess)).ToArray(),
            fullAccess ? workerEvidence.Select(ToWorkerEvidence).ToArray() : [], audit, readiness,
            configuration is null ? EmptyConfigurationETag(groupEvent.Id) : ConfigurationETag(configuration), Classification);
    }

    private IQueryable<EventChildRegistration> ChildQuery(Guid eventId) => db.EventChildRegistrations.Where(x => x.EventId == eventId)
        .Include(x => x.Event).Include(x => x.Enrollment).Include(x => x.ChildMember)
        .Include(x => x.Guardians).ThenInclude(x => x.GuardianMember)
        .Include(x => x.ConsentRecords)
        .Include(x => x.AuthorisedCollectors)
        .Include(x => x.AttendanceRecords).ThenInclude(x => x.Collector);

    private IQueryable<EventChildGuardianRelationship> GuardianQuery(Guid eventId) => db.EventChildGuardianRelationships
        .Where(x => x.ChildRegistration.EventId == eventId)
        .Include(x => x.ChildRegistration).ThenInclude(x => x.Event)
        .Include(x => x.ChildRegistration).ThenInclude(x => x.ChildMember);

    private async Task<AppResult<GroupEvent>> RequireLead(Guid eventId, Guid memberId, CancellationToken ct)
    {
        var groupEvent = await FindEvent(eventId, ct);
        if (groupEvent is null) return AppResult<GroupEvent>.NotFound("Event not found.");
        if (!await IsModuleEnabled(eventId, ct)) return AppResult<GroupEvent>.Conflict("SAFEGUARDING.CHILD is not enabled by the accepted plan.");
        if (!await IsLead(eventId, memberId, ct)) return AppResult<GroupEvent>.Forbidden("Accepted safeguarding lead access is required.");
        return AppResult<GroupEvent>.Success(groupEvent);
    }

    private async Task<AppResult<GroupEvent>> RequireDuty(Guid eventId, Guid occurrenceId, Guid memberId, CancellationToken ct)
    {
        var groupEvent = await FindEvent(eventId, ct);
        if (groupEvent is null) return AppResult<GroupEvent>.NotFound("Event not found.");
        if (!await db.EventOccurrences.AsNoTracking().AnyAsync(x => x.Id == occurrenceId && x.EventId == eventId && x.Status != EventOccurrenceStatus.Cancelled, ct))
            return AppResult<GroupEvent>.NotFound("Active event occurrence not found.");
        if (!await CanPerformCheckInDuty(eventId, occurrenceId, memberId, ct))
            return AppResult<GroupEvent>.Forbidden("Eligible safeguarding check-in duty access is required.");
        return AppResult<GroupEvent>.Success(groupEvent);
    }

    private Task<GroupEvent?> FindEvent(Guid eventId, CancellationToken ct)
        => db.GroupEvents.FirstOrDefaultAsync(x => x.Id == eventId, ct);

    private Task<bool> IsLead(Guid eventId, Guid memberId, CancellationToken ct)
        => db.EventRoleAssignments.AsNoTracking().AnyAsync(x => x.EventId == eventId && x.MemberId == memberId &&
            x.RoleRequirementKey == EventSafeguardingReadiness.LeadRoleKey && x.Status == EventRoleAssignmentStatus.Accepted && x.EndedUtc == null, ct);

    private async Task<bool> CanPerformCheckInDuty(Guid eventId, Guid occurrenceId, Guid memberId, CancellationToken ct)
    {
        if (await IsLead(eventId, memberId, ct)) return true;
        var hasRole = await db.EventRoleAssignments.AsNoTracking().AnyAsync(x => x.EventId == eventId && x.MemberId == memberId &&
            x.RoleRequirementKey == EventSafeguardingReadiness.CheckInWorkerRoleKey && x.Status == EventRoleAssignmentStatus.Accepted && x.EndedUtc == null &&
            (x.ScopeType == "event" || (x.ScopeType == "occurrence" && x.ScopeId == occurrenceId)), ct);
        if (!hasRole) return false;
        var configuration = await db.EventSafeguardingConfigurations.AsNoTracking().Include(x => x.PolicyVersion).FirstOrDefaultAsync(x => x.EventId == eventId, ct);
        var requirements = configuration is null ? null : EventSafeguardingReadiness.ParsePolicy(configuration.PolicyVersion.RequirementsJson);
        var requirement = requirements?.WorkerRequirements?.FirstOrDefault(x => x.RoleRequirementKey == EventSafeguardingReadiness.CheckInWorkerRoleKey);
        return requirement is not null && await db.EventSafeguardingWorkerEligibility.AsNoTracking().AnyAsync(x =>
            x.EventId == eventId && x.PolicyVersionId == configuration!.PolicyVersionId && x.MemberId == memberId &&
            x.RoleRequirementKey == EventSafeguardingReadiness.CheckInWorkerRoleKey && x.EligibilityEvidenceCode == requirement.EligibilityEvidenceCode && x.IsEligible, ct);
    }

    private async Task<Guid?> ResolveDutyOccurrence(Guid eventId, Guid memberId, CancellationToken ct)
    {
        var roles = await db.EventRoleAssignments.AsNoTracking().Where(x => x.EventId == eventId && x.MemberId == memberId &&
            x.RoleRequirementKey == EventSafeguardingReadiness.CheckInWorkerRoleKey && x.Status == EventRoleAssignmentStatus.Accepted && x.EndedUtc == null)
            .ToListAsync(ct);
        var scoped = roles.FirstOrDefault(x => x.ScopeType == "occurrence" && x.ScopeId.HasValue)?.ScopeId;
        if (scoped.HasValue) return scoped;
        if (!roles.Any(x => x.ScopeType == "event")) return null;
        return await db.EventOccurrences.AsNoTracking().Where(x => x.EventId == eventId && x.Status == EventOccurrenceStatus.Scheduled)
            .OrderBy(x => x.StartUtc).Select(x => (Guid?)x.Id).FirstOrDefaultAsync(ct);
    }

    private async Task<bool> IsModuleEnabled(Guid eventId, CancellationToken ct)
    {
        var snapshot = await db.EventPlanSnapshots.AsNoTracking().Where(x => x.EventId == eventId && x.IsActive)
            .OrderByDescending(x => x.Version).FirstOrDefaultAsync(ct);
        if (snapshot is null) return false;
        try { return EventCompositionPersistence.ToSnapshotDto(snapshot).Plan.ModuleDecisions.Any(x => x.ModuleCode == ModuleCode &&
            x.Status is EventModuleDecisionStatus.Required or EventModuleDecisionStatus.Selected); }
        catch (JsonException) { return false; }
    }

    private async Task<bool> IsApplicablePolicy(GroupEvent groupEvent, EventSafeguardingPolicyVersion policy, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        if (!policy.IsPublished || policy.EffectiveFromUtc > now || policy.RetiredUtc <= now) return false;
        if (policy.GroupId == groupEvent.GroupId) return true;
        return await EventCompositionPersistence.FindChurchRootIdAsync(db, groupEvent.GroupId, ct) == policy.GroupId;
    }

    private async Task<bool> HasRecognizedPolicy(Guid eventId, CancellationToken ct)
    {
        var config = await db.EventSafeguardingConfigurations.AsNoTracking().Include(x => x.PolicyVersion)
            .FirstOrDefaultAsync(x => x.EventId == eventId, ct);
        var now = DateTime.UtcNow;
        return config is not null && config.PolicyVersion.IsPublished && config.PolicyVersion.EffectiveFromUtc <= now &&
            (!config.PolicyVersion.RetiredUtc.HasValue || config.PolicyVersion.RetiredUtc > now) &&
            EventSafeguardingReadiness.ParsePolicy(config.PolicyVersion.RequirementsJson) is not null;
    }

    private async Task<bool> IsEventMember(GroupEvent groupEvent, Guid memberId, CancellationToken ct)
        => await authorization.IsApprovedMemberAsync(groupEvent.GroupId, memberId, ct) ||
           await db.EventEnrollments.AsNoTracking().AnyAsync(x => x.EventId == groupEvent.Id && x.MemberId == memberId, ct);

    private async Task<AppResult<EventSafeguardingWorkspaceDto>> SaveWorkspace(GroupEvent groupEvent, Guid? occurrenceId, bool fullAccess, string conflict, CancellationToken ct)
    {
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException) { return AppResult<EventSafeguardingWorkspaceDto>.PreconditionFailed(conflict); }
        catch (DbUpdateException) { return AppResult<EventSafeguardingWorkspaceDto>.Conflict(conflict); }
        return AppResult<EventSafeguardingWorkspaceDto>.Success(await BuildWorkspace(groupEvent, occurrenceId, fullAccess, ct));
    }

    private async Task<AppResult<EventSafeguardingMyContextDto>> SaveMyContext(Guid eventId, Guid memberId, string conflict, CancellationToken ct)
    {
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException) { return AppResult<EventSafeguardingMyContextDto>.PreconditionFailed(conflict); }
        catch (DbUpdateException) { return AppResult<EventSafeguardingMyContextDto>.Conflict(conflict); }
        return await GetMyContextAsync(eventId, memberId, ct);
    }

    private async Task<AppResult<EventIdempotencyRecord?>> BeginIdempotent<T>(string operation, Guid scopeId, Guid memberId, T request, string key, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(key) || key.Trim().Length > 200)
            return AppResult<EventIdempotencyRecord?>.Validation("A valid Idempotency-Key header is required.");
        var hash = EventCompositionEngine.Hash(new { scopeId, memberId, request });
        var existing = await db.EventIdempotencyRecords.AsNoTracking().FirstOrDefaultAsync(x => x.Operation == operation && x.ScopeId == scopeId && x.Key == key.Trim(), ct);
        if (existing is null) return AppResult<EventIdempotencyRecord?>.Success(null);
        return existing.RequestHash == hash ? AppResult<EventIdempotencyRecord?>.Success(existing)
            : AppResult<EventIdempotencyRecord?>.Conflict("The Idempotency-Key was already used with a different request.");
    }

    private static EventIdempotencyRecord NewIdempotency<T>(string operation, Guid scopeId, string key, Guid memberId, T request, Guid resultId, DateTime now)
        => new() { Id = Guid.NewGuid(), Operation = operation, ScopeId = scopeId, Key = key.Trim(),
            RequestHash = EventCompositionEngine.Hash(new { scopeId, memberId, request }), ResultEntityId = resultId,
            CreatedUtc = now, ExpiresUtc = now.AddHours(24) };

    private void AddAudit(string action, GroupEvent groupEvent, Guid actor, Guid? childId, DateTime now)
        => db.AuditLogs.Add(new AuditLog { Id = Guid.NewGuid(), ActorMemberId = actor, Action = action,
            EntityType = childId.HasValue ? "EventChildRegistration" : "EventSafeguardingConfiguration",
            EntityId = childId, GroupId = groupEvent.GroupId, EventId = groupEvent.Id,
            TargetMemberId = null, OccurredUtc = now });

    private static EventSafeguardingPolicySummaryDto ToPolicy(EventSafeguardingPolicyVersion x)
        => new(x.Id, x.PolicyCode, x.Version, new(x.NameEn, x.NameZh), x.EffectiveFromUtc, x.RetiredUtc,
            EventSafeguardingReadiness.ParsePolicy(x.RequirementsJson) is not null);

    private static EventSafeguardingChildDto ToChild(EventChildRegistration child, Guid? occurrenceId, Guid? policyId, bool fullAccess)
    {
        var confirmed = child.Guardians.Where(x => x.Status == EventGuardianRelationshipStatus.Confirmed).ToArray();
        var consent = policyId.HasValue && confirmed.Any(g => child.ConsentRecords.Where(x => x.GuardianRelationshipId == g.Id && x.PolicyVersionId == policyId)
            .OrderByDescending(x => x.RecordedUtc).FirstOrDefault()?.Decision == EventGuardianConsentDecision.Granted);
        var collectors = child.AuthorisedCollectors.Where(x => x.IsActive && confirmed.Any(g => g.Id == x.AuthorisedByGuardianRelationshipId)).ToArray();
        var attendance = occurrenceId.HasValue ? child.AttendanceRecords.FirstOrDefault(x => x.EventOccurrenceId == occurrenceId) : null;
        return new(child.Id, fullAccess ? child.EnrollmentId : Guid.Empty, fullAccess ? child.ChildMemberId : Guid.Empty,
            child.ChildMember.DisplayName ?? string.Empty, child.PhotoUrl,
            consent, collectors.Length > 0,
            fullAccess ? child.Guardians.Select(x => new EventChildGuardianDto(x.Id, x.GuardianMemberId,
                x.GuardianMember.DisplayName ?? string.Empty, x.RelationshipLabel, x.Status, GuardianETag(x))).ToArray() : [],
            collectors.Select(x => new EventChildCollectorDto(x.Id, x.DisplayName, x.RelationshipLabel, x.IsActive, CollectorETag(x))).ToArray(),
            attendance is null ? null : ToAttendance(attendance), ChildETag(child));
    }

    private static EventSafeguardingMyContextDto ToMyContext(Guid eventId, Guid memberId, Guid? policyId, IReadOnlyList<EventChildRegistration> children)
        => new(eventId, children.Select(child =>
        {
            var relationship = child.Guardians.FirstOrDefault(x => x.GuardianMemberId == memberId && x.Status != EventGuardianRelationshipStatus.Ended);
            var consent = relationship is not null && policyId.HasValue && child.ConsentRecords
                .Where(x => x.GuardianRelationshipId == relationship.Id && x.PolicyVersionId == policyId)
                .OrderByDescending(x => x.RecordedUtc).FirstOrDefault()?.Decision == EventGuardianConsentDecision.Granted;
            return new EventSafeguardingMyChildDto(child.Id, child.ChildMemberId, child.ChildMember.DisplayName ?? string.Empty,
                child.PhotoUrl, relationship is not null, relationship?.Id,
                relationship is null ? null : GuardianETag(relationship), relationship?.Status, consent,
                relationship is not null ? child.AuthorisedCollectors.Where(x => x.AuthorisedByGuardianRelationshipId == relationship.Id)
                    .Select(x => new EventChildCollectorDto(x.Id, x.DisplayName, x.RelationshipLabel, x.IsActive, CollectorETag(x))).ToArray() : [],
                child.AttendanceRecords.Select(ToAttendance).ToArray());
        }).ToArray(), "userSpecific");

    private static EventChildAttendanceDto ToAttendance(EventChildAttendance x)
        => new(x.Id, x.EventOccurrenceId, x.State, x.CheckedInUtc, x.CheckedOutUtc, x.CollectorId, x.Collector?.DisplayName, AttendanceETag(x));
    private static EventSafeguardingWorkerEvidenceDto ToWorkerEvidence(EventSafeguardingWorkerEligibility x)
        => new(x.Id, x.MemberId, x.Member.DisplayName ?? string.Empty, x.RoleRequirementKey, x.EligibilityEvidenceCode,
            x.EvidenceReference, x.IsEligible, x.VerifiedByMemberId, x.VerifiedUtc, WorkerEvidenceETag(x));

    private static string? Normalize(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    private static bool Matches(string? actual, string expected) => !string.IsNullOrWhiteSpace(actual) && actual.Trim() == expected;
    private static string EmptyConfigurationETag(Guid eventId) => $"\"safeguarding-{eventId:N}-unconfigured\"";
    private static string ConfigurationETag(EventSafeguardingConfiguration x) => $"\"safeguarding-config-{x.ConcurrencyToken:N}\"";
    private static string ChildETag(EventChildRegistration x) => $"\"safeguarding-child-{x.ConcurrencyToken:N}\"";
    private static string GuardianETag(EventChildGuardianRelationship x) => $"\"safeguarding-guardian-{x.ConcurrencyToken:N}\"";
    private static string CollectorETag(EventChildAuthorisedCollector x) => $"\"safeguarding-collector-{x.ConcurrencyToken:N}\"";
    private static string AttendanceETag(EventChildAttendance x) => $"\"safeguarding-attendance-{x.ConcurrencyToken:N}\"";
    private static string WorkerEvidenceETag(EventSafeguardingWorkerEligibility x) => $"\"safeguarding-worker-{x.ConcurrencyToken:N}\"";

    private static AppResult<TTarget> Failure<TTarget, TSource>(AppResult<TSource> source) => source.Status switch
    {
        AppResultStatus.NotFound => AppResult<TTarget>.NotFound(source.Message!),
        AppResultStatus.Forbidden => AppResult<TTarget>.Forbidden(source.Message!),
        AppResultStatus.Conflict => AppResult<TTarget>.Conflict(source.Message!),
        AppResultStatus.PreconditionFailed => AppResult<TTarget>.PreconditionFailed(source.Message!),
        _ => AppResult<TTarget>.Validation(source.Message ?? "Request failed.")
    };
}
