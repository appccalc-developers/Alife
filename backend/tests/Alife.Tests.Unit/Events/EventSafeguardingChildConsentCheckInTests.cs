using System.Text.Json;
using Alife.Api.Controllers;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using NSubstitute;

namespace Alife.Tests.Unit.Events;

public sealed class EventSafeguardingChildConsentCheckInTests
{
    private static readonly DateTime OccurrenceStart = new(2026, 10, 18, 9, 0, 0, DateTimeKind.Utc);

    [Fact]
    public async Task AccessMatrix_SeparatesLeadWorkerGuardianParticipantTeamAndUnrelatedMember()
    {
        await using var db = CreateDb();
        var seeded = Seed(db);
        await db.SaveChangesAsync();
        var service = new EventSafeguardingService(db, Authorization());

        Assert.True((await service.GetWorkspaceAsync(seeded.Event.Id, null, seeded.Lead.Id, default)).IsSuccess);
        var worker = await service.GetWorkspaceAsync(seeded.Event.Id, null, seeded.Worker.Id, default);
        Assert.True(worker.IsSuccess, worker.Message);
        Assert.Equal("checkInDuty", worker.Value!.AccessMode);
        Assert.Equal(Guid.Empty, Assert.Single(worker.Value.Children).EnrollmentId);
        Assert.Empty(Assert.Single(worker.Value.Children).Guardians);
        Assert.Empty(worker.Value.WorkerEvidence);
        Assert.Empty(worker.Value.Audit);
        Assert.Equal(AppResultStatus.Forbidden, (await service.GetWorkspaceAsync(seeded.Event.Id, null, seeded.OrdinaryTeam.Id, default)).Status);
        Assert.Equal(AppResultStatus.Forbidden, (await service.GetWorkspaceAsync(seeded.Event.Id, null, seeded.Guardian.Id, default)).Status);
        Assert.Equal(AppResultStatus.Forbidden, (await service.GetWorkspaceAsync(seeded.Event.Id, null, seeded.Unrelated.Id, default)).Status);
        Assert.True((await service.GetMyContextAsync(seeded.Event.Id, seeded.Guardian.Id, default)).IsSuccess);
        Assert.True((await service.GetMyContextAsync(seeded.Event.Id, seeded.Child.Id, default)).IsSuccess);
        Assert.Equal(AppResultStatus.Forbidden, (await service.GetMyContextAsync(seeded.Event.Id, seeded.OrdinaryTeam.Id, default)).Status);
    }

    [Fact]
    public async Task UnauthorizedUsersCannotReadOrWriteSafeguardingRecords()
    {
        await using var db = CreateDb();
        var seeded = Seed(db);
        await db.SaveChangesAsync();
        var service = new EventSafeguardingService(db, Authorization());

        Assert.Equal(AppResultStatus.Forbidden, (await service.RegisterChildAsync(seeded.Event.Id, seeded.OrdinaryTeam.Id,
            new(seeded.Enrollment.Id, null), "ordinary-register", default)).Status);
        Assert.Equal(AppResultStatus.Forbidden, (await service.CheckInAsync(seeded.Event.Id, seeded.Occurrence.Id,
            seeded.ChildRegistration.Id, seeded.Guardian.Id, seeded.ChildETag, "guardian-checkin", default)).Status);
        Assert.Empty(await db.AuditLogs.Where(x => x.Action == "safeguarding.occurrence.check-in").ToListAsync());
    }

    [Fact]
    public async Task CheckInAndCheckOut_EnforceStateMachineCollectorAndDoubleActionRules()
    {
        await using var db = CreateDb();
        var seeded = Seed(db);
        await db.SaveChangesAsync();
        var service = new EventSafeguardingService(db, Authorization());
        var view = await service.GetWorkspaceAsync(seeded.Event.Id, seeded.Occurrence.Id, seeded.Lead.Id, default);
        var child = Assert.Single(view.Value!.Children);

        var checkedIn = await service.CheckInAsync(seeded.Event.Id, seeded.Occurrence.Id, child.Id, seeded.Lead.Id,
            child.ETag, "checkin-1", default);
        Assert.True(checkedIn.IsSuccess, checkedIn.Message);
        var present = Assert.Single(checkedIn.Value!.Children).Attendance!;
        Assert.Equal(EventChildAttendanceState.Present, present.State);
        Assert.True((await service.CheckInAsync(seeded.Event.Id, seeded.Occurrence.Id, child.Id, seeded.Lead.Id,
            child.ETag, "checkin-1", default)).IsSuccess);
        var doubleCheckIn = await service.CheckInAsync(seeded.Event.Id, seeded.Occurrence.Id, child.Id, seeded.Lead.Id,
            Assert.Single(checkedIn.Value.Children).ETag, "checkin-2", default);
        Assert.Equal(AppResultStatus.Conflict, doubleCheckIn.Status);

        var unknownCollector = await service.CheckOutAsync(seeded.Event.Id, seeded.Occurrence.Id, child.Id, seeded.Lead.Id,
            new(Guid.NewGuid()), present.ETag, "checkout-unknown", default);
        Assert.Equal(AppResultStatus.Conflict, unknownCollector.Status);
        var checkedOut = await service.CheckOutAsync(seeded.Event.Id, seeded.Occurrence.Id, child.Id, seeded.Lead.Id,
            new(seeded.Collector.Id), present.ETag, "checkout-1", default);
        Assert.True(checkedOut.IsSuccess, checkedOut.Message);
        var completed = Assert.Single(checkedOut.Value!.Children).Attendance!;
        Assert.Equal(EventChildAttendanceState.CheckedOut, completed.State);
        Assert.Equal(seeded.Collector.Id, completed.CollectorId);
        Assert.True((await service.CheckOutAsync(seeded.Event.Id, seeded.Occurrence.Id, child.Id, seeded.Lead.Id,
            new(seeded.Collector.Id), present.ETag, "checkout-1", default)).IsSuccess);
        var doubleCheckOut = await service.CheckOutAsync(seeded.Event.Id, seeded.Occurrence.Id, child.Id, seeded.Lead.Id,
            new(seeded.Collector.Id), completed.ETag, "checkout-2", default);
        Assert.Equal(AppResultStatus.Conflict, doubleCheckOut.Status);
    }

    [Fact]
    public async Task SensitiveActions_WriteAppendOnlyMinimalAuditWithoutChildDetails()
    {
        await using var db = CreateDb();
        var seeded = Seed(db);
        await db.SaveChangesAsync();
        var service = new EventSafeguardingService(db, Authorization());
        var view = await service.GetWorkspaceAsync(seeded.Event.Id, seeded.Occurrence.Id, seeded.Lead.Id, default);

        await service.CheckInAsync(seeded.Event.Id, seeded.Occurrence.Id, seeded.ChildRegistration.Id, seeded.Lead.Id,
            Assert.Single(view.Value!.Children).ETag, "audit-checkin", default);
        var entries = await db.AuditLogs.Where(x => x.EventId == seeded.Event.Id && x.Action.StartsWith("safeguarding.")).ToListAsync();
        var entry = Assert.Single(entries, x => x.Action == "safeguarding.occurrence.check-in");
        Assert.Equal(seeded.ChildRegistration.Id, entry.EntityId);
        Assert.Null(entry.BeforeJson);
        Assert.Null(entry.AfterJson);
        Assert.Null(entry.MetadataJson);
        Assert.Null(entry.TargetMemberId);
        Assert.DoesNotContain(seeded.Child.DisplayName!, JsonSerializer.Serialize(entries.Select(x => new
        {
            x.Action, x.EntityId, x.ActorMemberId, x.TargetMemberId, x.BeforeJson, x.AfterJson, x.MetadataJson
        })), StringComparison.Ordinal);
        Assert.Equal("{}", (await db.EventEnrollments.SingleAsync(x => x.Id == seeded.Enrollment.Id)).EnrollmentJson);
    }

    [Fact]
    public async Task UnknownPolicyFailsClosed_AndNewPolicyVersionRequiresNewConsent()
    {
        await using var db = CreateDb();
        var seeded = Seed(db);
        var invalid = Policy(seeded.Group.Id, seeded.Lead.Id, 2, "{\"schemaVersion\":\"1\",\"consentRequired\":true,\"minimumAuthorisedCollectors\":1,\"workerRequirements\":[],\"unknownRule\":true}");
        db.EventSafeguardingPolicyVersions.Add(invalid);
        await db.SaveChangesAsync();
        var service = new EventSafeguardingService(db, Authorization());
        var view = await service.GetWorkspaceAsync(seeded.Event.Id, null, seeded.Lead.Id, default);

        var rejected = await service.ConfigurePolicyAsync(seeded.Event.Id, seeded.Lead.Id, new(invalid.Id),
            view.Value!.ConfigurationETag, "invalid-policy", default);
        Assert.Equal(AppResultStatus.ValidationError, rejected.Status);

        var v2 = Policy(seeded.Group.Id, seeded.Lead.Id, 3, PolicyJson());
        db.EventSafeguardingPolicyVersions.Add(v2);
        await db.SaveChangesAsync();
        var changed = await service.ConfigurePolicyAsync(seeded.Event.Id, seeded.Lead.Id, new(v2.Id),
            view.Value.ConfigurationETag, "policy-v2", default);
        Assert.True(changed.IsSuccess, changed.Message);
        var child = Assert.Single(changed.Value!.Children);
        Assert.False(child.ConsentCurrent);
        Assert.Contains(changed.Value.Readiness.Blockers, x => x.En.Contains("Guardian consent is missing", StringComparison.Ordinal));
    }

    [Fact]
    public async Task ReadinessUsesPolicyWorkerRequirementsWithoutHardCodedRatios()
    {
        await using var db = CreateDb();
        var seeded = Seed(db, requiredCheckInWorkers: 2);
        await db.SaveChangesAsync();
        var service = new EventSafeguardingService(db, Authorization());

        var blocked = await service.GetWorkspaceAsync(seeded.Event.Id, null, seeded.Lead.Id, default);
        Assert.False(blocked.Value!.Readiness.EligibleWorkersSatisfied);
        Assert.Contains(blocked.Value.Readiness.Blockers, x => x.En.Contains("1/2", StringComparison.Ordinal));
        var basePlan = EventCompositionPersistence.RefreshReadiness(EventCompositionPersistence.ToSnapshotDto(
            await db.EventPlanSnapshots.SingleAsync()).Plan, seeded.Event, DateTime.UtcNow);
        var operational = await EventCompositionPersistence.ApplyOperationalReadinessAsync(db, basePlan, seeded.Event, DateTime.UtcNow, default);
        Assert.Contains(Assert.Single(operational.Navigation, x => x.ModuleCode == "SAFEGUARDING.CHILD").Blockers,
            x => x.En.Contains("Required eligible workers", StringComparison.Ordinal));
        Assert.Contains("SAFEGUARDING.CHILD", await EventCompositionPersistence.GetProtectedModuleCodesAsync(db, seeded.Event, default));

        var ratioPolicy = Policy(seeded.Group.Id, seeded.Lead.Id, 9, JsonSerializer.Serialize(new
        {
            schemaVersion = "1", consentRequired = false, minimumAuthorisedCollectors = 0,
            workerRequirements = new[] {
                new { roleRequirementKey = EventSafeguardingReadiness.LeadRoleKey,
                    minimum = 1, maximumChildrenPerWorker = (int?)null, eligibilityEvidenceCode = "childMinistryApproved" },
                new { roleRequirementKey = EventSafeguardingReadiness.CheckInWorkerRoleKey,
                    minimum = 0, maximumChildrenPerWorker = (int?)1, eligibilityEvidenceCode = "eventCheckInApproved" }
            }
        }));
        var ratioConfig = new EventSafeguardingConfiguration { PolicyVersionId = ratioPolicy.Id, PolicyVersion = ratioPolicy };
        var ratioRoles = new[] { Role(seeded.Event.Id, seeded.Lead.Id, EventSafeguardingReadiness.LeadRoleKey, seeded.Owner.Id),
            Role(seeded.Event.Id, seeded.Worker.Id, EventSafeguardingReadiness.CheckInWorkerRoleKey, seeded.Owner.Id) };
        var ratioEvidence = new[] {
            Evidence(seeded.Event.Id, ratioPolicy.Id, seeded.Lead.Id,
                EventSafeguardingReadiness.LeadRoleKey, "childMinistryApproved", seeded.Lead.Id),
            Evidence(seeded.Event.Id, ratioPolicy.Id, seeded.Worker.Id,
                EventSafeguardingReadiness.CheckInWorkerRoleKey, "eventCheckInApproved", seeded.Lead.Id)
        };
        var ratioReadiness = EventSafeguardingReadiness.Evaluate(ratioConfig,
            [new EventChildRegistration { Id = Guid.NewGuid() }, new EventChildRegistration { Id = Guid.NewGuid() }],
            ratioRoles, ratioEvidence, DateTime.UtcNow);
        Assert.Contains(ratioReadiness.Blockers, x => x.En.Contains("1/2", StringComparison.Ordinal));

        var secondChild = Member("Second child");
        var secondEnrollment = new EventEnrollment { Id = Guid.NewGuid(), GroupId = seeded.Group.Id,
            EventId = seeded.Event.Id, MemberId = secondChild.Id, EnrollmentJson = "{}",
            CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow };
        var secondRegistration = new EventChildRegistration { Id = Guid.NewGuid(), EventId = seeded.Event.Id,
            EnrollmentId = secondEnrollment.Id, ChildMemberId = secondChild.Id,
            CreatedByMemberId = seeded.Lead.Id, CreatedUtc = DateTime.UtcNow };
        var persistedConfig = await db.EventSafeguardingConfigurations.SingleAsync();
        persistedConfig.PolicyVersionId = ratioPolicy.Id;
        persistedConfig.PolicyVersion = ratioPolicy;
        db.Members.Add(secondChild);
        db.EventEnrollments.Add(secondEnrollment);
        db.EventChildRegistrations.Add(secondRegistration);
        db.EventSafeguardingPolicyVersions.Add(ratioPolicy);
        db.EventSafeguardingWorkerEligibility.AddRange(ratioEvidence);
        await db.SaveChangesAsync();

        var checkIn = await service.CheckInAsync(seeded.Event.Id, seeded.Occurrence.Id,
            seeded.ChildRegistration.Id, seeded.Lead.Id, seeded.ChildETag, "ratio-check-in", default);
        Assert.Equal(AppResultStatus.Conflict, checkIn.Status);
    }

    [Fact]
    public async Task StaleChildTokenCannotWinConcurrentCheckIn()
    {
        var root = new InMemoryDatabaseRoot();
        var options = new DbContextOptionsBuilder<AlifeDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString("N"), root).Options;
        Seeded seeded;
        await using (var seedDb = new AlifeDbContext(options)) { seeded = Seed(seedDb); await seedDb.SaveChangesAsync(); }
        await using var winnerDb = new AlifeDbContext(options);
        await using var staleDb = new AlifeDbContext(options);
        var winner = new EventSafeguardingService(winnerDb, Authorization());
        var stale = new EventSafeguardingService(staleDb, Authorization());
        var winnerView = await winner.GetWorkspaceAsync(seeded.Event.Id, seeded.Occurrence.Id, seeded.Lead.Id, default);
        var staleView = await stale.GetWorkspaceAsync(seeded.Event.Id, seeded.Occurrence.Id, seeded.Lead.Id, default);
        var first = await winner.CheckInAsync(seeded.Event.Id, seeded.Occurrence.Id, seeded.ChildRegistration.Id,
            seeded.Lead.Id, Assert.Single(winnerView.Value!.Children).ETag, "winner", default);
        var second = await stale.CheckInAsync(seeded.Event.Id, seeded.Occurrence.Id, seeded.ChildRegistration.Id,
            seeded.Lead.Id, Assert.Single(staleView.Value!.Children).ETag, "stale", default);
        Assert.True(first.IsSuccess, first.Message);
        Assert.Equal(AppResultStatus.PreconditionFailed, second.Status);
    }

    [Fact]
    public async Task SafeguardingEndpointsArePrivateNoStore()
    {
        var eventId = Guid.NewGuid(); var memberId = Guid.NewGuid();
        var service = Substitute.For<IEventSafeguardingService>();
        service.GetMyContextAsync(eventId, memberId, Arg.Any<CancellationToken>()).Returns(
            AppResult<EventSafeguardingMyContextDto>.Success(new(eventId, [], "userSpecific")));
        var accessor = Substitute.For<ICurrentMemberAccessor>(); accessor.GetCurrentMemberId().Returns(memberId);
        var controller = new EventSafeguardingController(service, accessor)
        { ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() } };

        var response = await controller.GetMyContext(eventId, default);

        Assert.IsType<OkObjectResult>(response);
        Assert.Equal("private, no-store", controller.Response.Headers.CacheControl.ToString());
        Assert.Equal("no-cache", controller.Response.Headers.Pragma.ToString());
    }

    private static AlifeDbContext CreateDb() => new(new DbContextOptionsBuilder<AlifeDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString("N")).Options);

    private static Seeded Seed(AlifeDbContext db, int requiredCheckInWorkers = 1)
    {
        var group = new Group { Id = Guid.NewGuid(), NameJson = "{}", CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow };
        var owner = Member("Owner"); var lead = Member("Safeguarding lead"); var worker = Member("Check-in worker");
        var ordinary = Member("Ordinary event team"); var guardian = Member("Guardian"); var child = Member("Child participant"); var unrelated = Member("Unrelated member");
        var groupEvent = new GroupEvent { Id = Guid.NewGuid(), GroupId = group.Id, CreatedByMemberId = owner.Id,
            AccountableOwnerMemberId = owner.Id, TitleEn = "Child event", TitleZh = "兒童活動", StartDate = OccurrenceStart,
            EndDate = OccurrenceStart.AddHours(3), CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow };
        var occurrence = new EventOccurrence { Id = Guid.NewGuid(), EventId = groupEvent.Id, StartUtc = OccurrenceStart,
            EndUtc = OccurrenceStart.AddHours(3), LocalDate = DateOnly.FromDateTime(OccurrenceStart), CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow };
        var enrollment = new EventEnrollment { Id = Guid.NewGuid(), GroupId = group.Id, EventId = groupEvent.Id,
            MemberId = child.Id, EnrollmentJson = "{}", CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow };
        var policy = Policy(group.Id, lead.Id, 1, PolicyJson(requiredCheckInWorkers));
        var configuration = new EventSafeguardingConfiguration { Id = Guid.NewGuid(), EventId = groupEvent.Id,
            PolicyVersionId = policy.Id, PolicyVersion = policy, ConfiguredByMemberId = lead.Id, ConfiguredUtc = DateTime.UtcNow };
        var childRegistration = new EventChildRegistration { Id = Guid.NewGuid(), EventId = groupEvent.Id,
            EnrollmentId = enrollment.Id, ChildMemberId = child.Id, PhotoUrl = "https://example.invalid/child.jpg",
            CreatedByMemberId = lead.Id, CreatedUtc = DateTime.UtcNow };
        var relationship = new EventChildGuardianRelationship { Id = Guid.NewGuid(), ChildRegistrationId = childRegistration.Id,
            GuardianMemberId = guardian.Id, RelationshipLabel = "Guardian", Status = EventGuardianRelationshipStatus.Confirmed,
            CreatedByMemberId = lead.Id, CreatedUtc = DateTime.UtcNow, ConfirmedUtc = DateTime.UtcNow };
        var consent = new EventChildConsentRecord { Id = Guid.NewGuid(), ChildRegistrationId = childRegistration.Id,
            GuardianRelationshipId = relationship.Id, PolicyVersionId = policy.Id, Decision = EventGuardianConsentDecision.Granted,
            RecordedByMemberId = guardian.Id, RecordedUtc = DateTime.UtcNow };
        var collector = new EventChildAuthorisedCollector { Id = Guid.NewGuid(), ChildRegistrationId = childRegistration.Id,
            AuthorisedByGuardianRelationshipId = relationship.Id, DisplayName = "Approved collector", RelationshipLabel = "Family",
            IsActive = true, AuthorisedUtc = DateTime.UtcNow };
        childRegistration.Guardians.Add(relationship); childRegistration.ConsentRecords.Add(consent); childRegistration.AuthorisedCollectors.Add(collector);
        var leadRole = Role(groupEvent.Id, lead.Id, EventSafeguardingReadiness.LeadRoleKey, owner.Id);
        var workerRole = Role(groupEvent.Id, worker.Id, EventSafeguardingReadiness.CheckInWorkerRoleKey, owner.Id);
        var ordinaryTeam = new EventTeamMember { Id = Guid.NewGuid(), EventId = groupEvent.Id, MemberId = ordinary.Id,
            InvitedByMemberId = owner.Id, Status = EventTeamMemberStatus.Accepted, JoinedUtc = DateTime.UtcNow,
            CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow };
        var leadEvidence = Evidence(groupEvent.Id, policy.Id, lead.Id, EventSafeguardingReadiness.LeadRoleKey, "childMinistryApproved", lead.Id);
        var workerEvidence = Evidence(groupEvent.Id, policy.Id, worker.Id, EventSafeguardingReadiness.CheckInWorkerRoleKey, "eventCheckInApproved", lead.Id);
        db.Groups.Add(group); db.Members.AddRange(owner, lead, worker, ordinary, guardian, child, unrelated);
        db.GroupEvents.Add(groupEvent); db.EventOccurrences.Add(occurrence); db.EventEnrollments.Add(enrollment);
        db.EventSafeguardingPolicyVersions.Add(policy); db.EventSafeguardingConfigurations.Add(configuration);
        db.EventChildRegistrations.Add(childRegistration); db.EventRoleAssignments.AddRange(leadRole, workerRole);
        db.EventTeamMembers.Add(ordinaryTeam); db.EventSafeguardingWorkerEligibility.AddRange(leadEvidence, workerEvidence);
        SeedSafeguardingPlan(db, groupEvent);
        return new(group, groupEvent, occurrence, enrollment, childRegistration, collector, owner, lead, worker, ordinary, guardian, child, unrelated,
            $"\"safeguarding-child-{childRegistration.ConcurrencyToken:N}\"");
    }

    private static EventSafeguardingPolicyVersion Policy(Guid groupId, Guid creator, int version, string json) => new()
    { Id = Guid.NewGuid(), GroupId = groupId, PolicyCode = "church-child-safety", Version = version,
        NameEn = "Church child safety", NameZh = "教會兒童安全", RequirementsJson = json, IsPublished = true,
        EffectiveFromUtc = DateTime.UtcNow.AddDays(-1), CreatedByMemberId = creator, CreatedUtc = DateTime.UtcNow };
    private static string PolicyJson(int workers = 1) => JsonSerializer.Serialize(new
    { schemaVersion = "1", consentRequired = true, minimumAuthorisedCollectors = 1,
        workerRequirements = new object[] { new { roleRequirementKey = EventSafeguardingReadiness.LeadRoleKey, minimum = 1, eligibilityEvidenceCode = "childMinistryApproved" },
            new { roleRequirementKey = EventSafeguardingReadiness.CheckInWorkerRoleKey, minimum = workers, eligibilityEvidenceCode = "eventCheckInApproved" } } });
    private static EventRoleAssignment Role(Guid eventId, Guid memberId, string key, Guid assignedBy) => new()
    { Id = Guid.NewGuid(), EventId = eventId, MemberId = memberId, RoleRequirementKey = key, ScopeType = "event",
        AssignedByMemberId = assignedBy, Status = EventRoleAssignmentStatus.Accepted, AcceptedUtc = DateTime.UtcNow,
        CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow };
    private static EventSafeguardingWorkerEligibility Evidence(Guid eventId, Guid policyId, Guid memberId, string role, string code, Guid verifier) => new()
    { Id = Guid.NewGuid(), EventId = eventId, PolicyVersionId = policyId, MemberId = memberId,
        RoleRequirementKey = role, EligibilityEvidenceCode = code, EvidenceReference = "event-attestation", IsEligible = true,
        VerifiedByMemberId = verifier, VerifiedUtc = DateTime.UtcNow };
    private static Member Member(string name) => new() { Id = Guid.NewGuid(), DisplayName = name, IsRegistered = true, CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow };
    private static void SeedSafeguardingPlan(AlifeDbContext db, GroupEvent groupEvent)
    {
        var facts = new[] { new EventFactInputDto("people.childrenPresent", JsonSerializer.SerializeToElement(true), EventFactCertainty.Confirmed, EventFactSource.Human),
            new EventFactInputDto("people.registrationMode", JsonSerializer.SerializeToElement("required"), EventFactCertainty.Confirmed, EventFactSource.Human) };
        var plan = new EventCompositionEngine().Compose(new(EventCompositionDefinitions.LegacySchemaVersion, null, new(facts), []),
            new EventCompositionContext("\"baseline\"", HasAccountableOwner: true)).Value!;
        groupEvent.ActivePlanVersion = 1;
        db.EventPlanSnapshots.Add(new EventPlanSnapshot { Id = Guid.NewGuid(), EventId = groupEvent.Id, Version = 1,
            SourceFactSetId = Guid.NewGuid(), SchemaVersion = plan.SchemaVersion, ProposalHash = plan.ProposalHash,
            ETag = EventCompositionPersistence.CreatePlanETag(1, plan.ProposalHash), SnapshotJson = EventCompositionPersistence.SerializePlan(plan, []),
            IsActive = true, AcceptedByMemberId = groupEvent.AccountableOwnerMemberId, AcceptedUtc = DateTime.UtcNow, CreatedUtc = DateTime.UtcNow });
    }
    private static IGroupAuthorizationService Authorization()
    {
        var value = Substitute.For<IGroupAuthorizationService>();
        value.IsApprovedMemberAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(true);
        return value;
    }
    private sealed record Seeded(Group Group, GroupEvent Event, EventOccurrence Occurrence, EventEnrollment Enrollment,
        EventChildRegistration ChildRegistration, EventChildAuthorisedCollector Collector, Member Owner, Member Lead,
        Member Worker, Member OrdinaryTeam, Member Guardian, Member Child, Member Unrelated, string ChildETag);
}
