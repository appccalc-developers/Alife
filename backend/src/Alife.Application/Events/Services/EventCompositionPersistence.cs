using System.Text.Json;
using Alife.Application.Common.Interfaces;
using Alife.Application.Events.Dtos;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Services;

public static class EventCompositionPersistence
{
    private static readonly JsonSerializerOptions JsonOptions = EventCompositionEngine.CreateJsonOptions();

    public static string SerializePlan(EventPlanProposalDto proposal, IReadOnlyList<HumanDecisionInput> decisions)
        => JsonSerializer.Serialize(new StoredEventPlanDocument(proposal, decisions), JsonOptions);

    public static EventPlanSnapshotDto ToSnapshotDto(EventPlanSnapshot snapshot)
    {
        if (!snapshot.IsLegacyBackfill)
        {
            var stored = JsonSerializer.Deserialize<StoredEventPlanDocument>(snapshot.SnapshotJson, JsonOptions)
                ?? throw new JsonException("Event plan snapshot payload is missing.");
            return new EventPlanSnapshotDto(
                snapshot.EventId,
                snapshot.Version,
                snapshot.AcceptedByMemberId,
                snapshot.AcceptedUtc,
                snapshot.ETag,
                false,
                stored.Plan,
                stored.HumanDecisions);
        }

        return CreateLegacySnapshot(snapshot);
    }

    public static string CreatePlanETag(int version, string proposalHash)
        => $"\"plan-{version}-{proposalHash[..Math.Min(16, proposalHash.Length)]}\"";

    public static string CreateEmptyPlanETag(GroupEvent groupEvent)
        => $"\"plan-{groupEvent.ActivePlanVersion ?? 0}-{groupEvent.PlanConcurrencyToken:N}\"";

    public static async Task<EventWorkflowRecommendationDto?> ResolveWorkflowRecommendationAsync(
        IAlifeDbContext dbContext,
        Guid groupId,
        EventPlanComposeRequest request,
        CancellationToken cancellationToken,
        IReadOnlyDictionary<string, EventActivityTypeDefinition>? activityTypesByCode = null)
    {
        activityTypesByCode ??= EventCompositionDefinitions.ActivityTypesByCode;
        if (string.IsNullOrWhiteSpace(request.ActivityTypeCode) ||
            !activityTypesByCode.TryGetValue(request.ActivityTypeCode, out var activityType) ||
            string.IsNullOrWhiteSpace(activityType.RecommendedWorkflowTemplateCode))
        {
            return null;
        }

        var code = activityType.RecommendedWorkflowTemplateCode;
        var template = await dbContext.EventWorkflowTemplates.AsNoTracking()
            .Where(x => x.IsActive && x.Code == code &&
                (x.OwnerGroupId == null || x.OwnerGroupId == groupId))
            .OrderByDescending(x => x.OwnerGroupId == groupId)
            .ThenByDescending(x => x.Version)
            .FirstOrDefaultAsync(cancellationToken);
        if (template is null)
        {
            return new EventWorkflowRecommendationDto(code, null, null, "unavailable");
        }
        return new EventWorkflowRecommendationDto(
            code,
            template.Version,
            new LocalizedTextDto(template.NameEn, template.NameZh),
            request.UseRecommendedWorkflow ? "selected" : "declined");
    }

    public static async Task<bool> CanManageEventAsync(
        IAlifeDbContext dbContext,
        IGroupAuthorizationService groupAuthorizationService,
        GroupEvent groupEvent,
        Guid memberId,
        CancellationToken cancellationToken)
        => groupEvent.AccountableOwnerMemberId == memberId ||
           await groupAuthorizationService.IsLeaderOrCoLeaderAsync(
               groupEvent.GroupId, memberId, cancellationToken);

    public static async Task<bool> CanViewEventTeamAsync(
        IAlifeDbContext dbContext,
        IGroupAuthorizationService groupAuthorizationService,
        GroupEvent groupEvent,
        Guid memberId,
        CancellationToken cancellationToken)
    {
        if (await CanManageEventAsync(dbContext, groupAuthorizationService, groupEvent, memberId, cancellationToken))
        {
            return true;
        }

        return await dbContext.EventRoleAssignments.AsNoTracking().AnyAsync(
            x => x.EventId == groupEvent.Id && x.MemberId == memberId &&
                x.Status == EventRoleAssignmentStatus.Accepted && x.EndedUtc == null,
            cancellationToken) ||
            await dbContext.EventTeamMembers.AsNoTracking().AnyAsync(
                x => x.EventId == groupEvent.Id && x.MemberId == memberId &&
                    x.Status == EventTeamMemberStatus.Accepted && x.EndedUtc == null,
                cancellationToken);
    }

    public static async Task<Guid?> FindChurchRootIdAsync(
        IAlifeDbContext dbContext,
        Guid groupId,
        CancellationToken cancellationToken)
    {
        var currentId = groupId;
        var visited = new HashSet<Guid>();
        while (visited.Add(currentId))
        {
            var group = await dbContext.Groups.AsNoTracking()
                .Where(x => x.Id == currentId)
                .Select(x => new { x.Id, x.ParentGroupId, x.IsChurch })
                .FirstOrDefaultAsync(cancellationToken);
            if (group is null)
            {
                return null;
            }
            if (group.IsChurch)
            {
                return group.Id;
            }
            if (!group.ParentGroupId.HasValue)
            {
                return null;
            }
            currentId = group.ParentGroupId.Value;
        }
        return null;
    }

    public static Task<bool> HasDirectGroupLeadershipAsync(
        IAlifeDbContext dbContext,
        Guid groupId,
        Guid memberId,
        CancellationToken cancellationToken)
        => dbContext.GroupMemberships.AsNoTracking().AnyAsync(
            membership => membership.GroupId == groupId &&
                membership.MemberId == memberId &&
                membership.Status == MembershipStatus.Approved &&
                (membership.Role == MembershipRole.Leader || membership.Role == MembershipRole.CoLeader),
            cancellationToken);

    public static async Task<IReadOnlySet<string>> GetProtectedModuleCodesAsync(
        IAlifeDbContext dbContext,
        GroupEvent groupEvent,
        CancellationToken cancellationToken)
    {
        var protectedCodes = new HashSet<string>(StringComparer.Ordinal) { "TEAM.WORK" };
        if (await dbContext.EventEnrollments.AsNoTracking().AnyAsync(x => x.EventId == groupEvent.Id, cancellationToken))
        {
            protectedCodes.Add("PEOPLE.REGISTRATION");
        }
        if (groupEvent.RamAssessment is not null &&
            (!string.Equals(groupEvent.RamAssessment.RamDataJson.Trim(), "{}", StringComparison.Ordinal) ||
             groupEvent.RamAssessment.Status != EventRamStatus.Draft))
        {
            protectedCodes.Add("SAFETY.RAM");
        }
        if (groupEvent.WorkflowRun is not null ||
            await dbContext.EventArtifacts.AsNoTracking().AnyAsync(x => x.EventId == groupEvent.Id, cancellationToken))
        {
            protectedCodes.Add("TEAM.WORK");
        }
        if (await dbContext.EventVenueReservations.AsNoTracking().AnyAsync(x => x.EventId == groupEvent.Id, cancellationToken))
        {
            protectedCodes.Add("PLACE.RESOURCE");
        }
        if (await dbContext.EventTravelDrivers.AsNoTracking().AnyAsync(x => x.EventId == groupEvent.Id, cancellationToken) ||
            await dbContext.EventTravelVehicles.AsNoTracking().AnyAsync(x => x.EventId == groupEvent.Id, cancellationToken) ||
            await dbContext.EventTravelJourneys.AsNoTracking().AnyAsync(x => x.EventId == groupEvent.Id, cancellationToken))
        {
            protectedCodes.Add("MOVE.STAY");
        }
        if (await dbContext.EventSafeguardingConfigurations.AsNoTracking().AnyAsync(x => x.EventId == groupEvent.Id, cancellationToken) ||
            await dbContext.EventChildRegistrations.AsNoTracking().AnyAsync(x => x.EventId == groupEvent.Id, cancellationToken) ||
            await dbContext.EventChildAttendanceRecords.AsNoTracking().AnyAsync(x => x.EventId == groupEvent.Id, cancellationToken))
        {
            protectedCodes.Add("SAFEGUARDING.CHILD");
        }

        var activeRoleKeys = await dbContext.EventRoleAssignments.AsNoTracking()
            .Where(x => x.EventId == groupEvent.Id && x.EndedUtc == null)
            .Select(x => x.RoleRequirementKey)
            .ToListAsync(cancellationToken);
        foreach (var key in activeRoleKeys)
        {
            var separator = key.IndexOf(':');
            if (separator > 0 && EventCompositionDefinitions.ModulesByCode.ContainsKey(key[..separator]))
            {
                protectedCodes.Add(key[..separator]);
            }
        }
        return protectedCodes;
    }

    public static IReadOnlySet<string> GetSatisfiedReadinessRules(GroupEvent groupEvent)
    {
        var rules = new HashSet<string>(StringComparer.Ordinal);
        if (groupEvent.AccountableOwnerMemberId != Guid.Empty)
        {
            rules.Add("accountable-owner-assigned");
        }
        if (groupEvent.RamAssessment is not null &&
            !string.Equals(groupEvent.RamAssessment.RamDataJson.Trim(), "{}", StringComparison.Ordinal))
        {
            rules.Add("ram-complete");
        }
        if (groupEvent.RamAssessment?.Status is EventRamStatus.AwaitingReview or EventRamStatus.Approved)
        {
            rules.Add("ram-submitted");
        }
        if (groupEvent.RamAssessment?.Status == EventRamStatus.Approved)
        {
            rules.Add("ram-approved");
        }
        return rules;
    }

    public static EventPlanProposalDto RefreshReadiness(
        EventPlanProposalDto plan,
        GroupEvent groupEvent,
        DateTime checkedUtc)
    {
        var satisfiedRules = GetSatisfiedReadinessRules(groupEvent);
        var blockersByModule = new Dictionary<string, IReadOnlyList<LocalizedTextDto>>(StringComparer.Ordinal);
        foreach (var decision in plan.ModuleDecisions.Where(x => x.Status == EventModuleDecisionStatus.Required))
        {
            if (!EventCompositionDefinitions.ModulesByCode.TryGetValue(decision.ModuleCode, out var module))
            {
                blockersByModule[decision.ModuleCode] =
                [new LocalizedTextDto(
                    $"Unknown module definition: {decision.ModuleCode}.",
                    $"未知模組定義：{decision.ModuleCode}。")];
                continue;
            }
            blockersByModule[module.Code] = module.ReadinessRules
                .Where(rule => !satisfiedRules.Contains(rule))
                .Select(rule => new LocalizedTextDto(
                    $"{module.Name.En}: complete {rule}.",
                    $"{module.Name.Zh}：完成 {rule}。"))
                .ToArray();
        }

        var blockers = blockersByModule.Values.SelectMany(x => x).ToList();
        if (groupEvent.GovernanceMode == EventGovernanceMode.ChurchSponsored &&
            groupEvent.SponsorshipStatus != EventSponsorshipStatus.Approved)
        {
            blockers.Add(new LocalizedTextDto(
                "Root-church sponsorship must be approved before public publication.",
                "公開發布前必須取得根教會 sponsorship 批准。"));
        }
        var status = blockers.Count == 0 ? EventReadinessStatus.Ready : EventReadinessStatus.Blocked;
        var readiness = new ReadinessDto(status, blockers, plan.Readiness.Warnings, checkedUtc);
        var navigation = plan.Navigation.Select(item =>
        {
            if (item.ModuleCode is null)
            {
                return item with { Readiness = status, Blockers = Array.Empty<LocalizedTextDto>() };
            }
            var itemBlockers = blockersByModule.GetValueOrDefault(item.ModuleCode) ?? [];
            return item with
            {
                Readiness = itemBlockers.Count == 0 ? EventReadinessStatus.Ready : EventReadinessStatus.Blocked,
                Blockers = itemBlockers
            };
        }).ToArray();
        return plan with { Readiness = readiness, Navigation = navigation };
    }

    public static async Task<EventPlanProposalDto> ApplyOperationalReadinessAsync(
        IAlifeDbContext dbContext,
        EventPlanProposalDto plan,
        GroupEvent groupEvent,
        DateTime checkedUtc,
        CancellationToken cancellationToken)
    {
        var additions = new Dictionary<string, List<LocalizedTextDto>>(StringComparer.Ordinal);
        void Add(string module, LocalizedTextDto blocker)
        {
            if (!additions.TryGetValue(module, out var values)) additions[module] = values = [];
            values.Add(blocker);
        }

        var roles = await dbContext.EventRoleAssignments.AsNoTracking()
            .Where(x => x.EventId == groupEvent.Id && x.EndedUtc == null).ToListAsync(cancellationToken);
        foreach (var requirement in plan.RoleRequirements.Where(x => x.Minimum > 0))
        {
            var accepted = roles.Count(x => x.RoleRequirementKey == requirement.RequirementKey &&
                x.Status == EventRoleAssignmentStatus.Accepted);
            if (accepted < requirement.Minimum)
            {
                var invited = roles.Count(x => x.RoleRequirementKey == requirement.RequirementKey &&
                    x.Status == EventRoleAssignmentStatus.Invited);
                var declined = roles.Count(x => x.RoleRequirementKey == requirement.RequirementKey &&
                    x.Status == EventRoleAssignmentStatus.Declined);
                Add(requirement.ModuleCode, new(
                    $"Role {requirement.RoleCode}: {accepted}/{requirement.Minimum} accepted ({invited} invited, {declined} declined).",
                    $"角色 {requirement.RoleCode}：已接受 {accepted}/{requirement.Minimum}（邀請中 {invited}、已拒絕 {declined}）。"));
            }
        }

        var tasks = await dbContext.EventTasks.AsNoTracking().Where(x => x.EventId == groupEvent.Id).ToListAsync(cancellationToken);
        foreach (var task in tasks.Where(x => x.IsRequired && (x.Status == EventTaskStatus.Blocked ||
            (x.DueUtc < checkedUtc && x.Status != EventTaskStatus.Done) || (x.RequiresApproval && x.Status != EventTaskStatus.Done))))
        {
            Add("TEAM.WORK", new($"Required task {task.TitleEn} is blocked, overdue, or awaiting approval.",
                $"必要任務「{task.TitleZh}」受阻、逾期或尚待批准。"));
        }

        if (plan.ModuleDecisions.Any(x => x.ModuleCode == "SERVICE.ROSTER" &&
            x.Status is EventModuleDecisionStatus.Required or EventModuleDecisionStatus.Selected))
        {
            var slots = await dbContext.EventServiceSlots.AsNoTracking().Where(x => x.Occurrence.EventId == groupEvent.Id)
                .Select(x => new { x.RoleCode, x.RequiredCount,
                    Confirmed = x.Assignments.Count(a => a.Status == EventRosterAssignmentStatus.Confirmed && a.EndedUtc == null) })
                .ToListAsync(cancellationToken);
            if (slots.Count == 0) Add("SERVICE.ROSTER", new("Define required service slots.", "請定義必要崗位。"));
            foreach (var slot in slots.Where(x => x.Confirmed < x.RequiredCount))
                Add("SERVICE.ROSTER", new($"{slot.RoleCode}: {slot.Confirmed}/{slot.RequiredCount} confirmed.",
                    $"{slot.RoleCode}：已確認 {slot.Confirmed}/{slot.RequiredCount}。"));
        }

        var satisfiedOperationalRules = new HashSet<(string ModuleCode, string RuleCode)>();
        if (plan.ModuleDecisions.Any(x => x.ModuleCode == "PLACE.RESOURCE" &&
            x.Status is EventModuleDecisionStatus.Required or EventModuleDecisionStatus.Selected))
        {
            var reservations = await dbContext.EventVenueReservations.AsNoTracking()
                .Where(x => x.EventId == groupEvent.Id && x.Status == EventVenueReservationStatus.Confirmed)
                .Select(x => new { x.Id, x.VenueId, x.EventOccurrenceId, x.StartUtc, x.EndUtc,
                    x.RequiredCapacity, VenueCapacity = x.Venue.Capacity })
                .ToListAsync(cancellationToken);
            var occurrences = await dbContext.EventOccurrences.AsNoTracking()
                .Where(x => x.EventId == groupEvent.Id && x.Status == EventOccurrenceStatus.Scheduled)
                .Select(x => new { x.Id, x.StartUtc, x.EndUtc }).ToListAsync(cancellationToken);
            var capacitySufficient = reservations.All(x => x.RequiredCapacity <= x.VenueCapacity);
            var bookingsConfirmed = occurrences.Count > 0
                ? occurrences.All(occurrence => reservations.Any(x => x.EventOccurrenceId == occurrence.Id ||
                    (!x.EventOccurrenceId.HasValue && x.StartUtc <= occurrence.StartUtc && x.EndUtc >= occurrence.EndUtc)))
                : reservations.Count > 0;
            var venueIds = reservations.Select(x => x.VenueId).Distinct().ToArray();
            var otherReservations = venueIds.Length == 0 ? [] : await dbContext.EventVenueReservations.AsNoTracking()
                .Where(x => venueIds.Contains(x.VenueId) && x.Status == EventVenueReservationStatus.Confirmed)
                .Select(x => new { x.Id, x.VenueId, x.StartUtc, x.EndUtc }).ToListAsync(cancellationToken);
            var conflict = reservations.FirstOrDefault(own => otherReservations.Any(other => other.Id != own.Id &&
                other.VenueId == own.VenueId && own.StartUtc < other.EndUtc && other.StartUtc < own.EndUtc));

            if (capacitySufficient) satisfiedOperationalRules.Add(("PLACE.RESOURCE", "capacity-sufficient"));
            else Add("PLACE.RESOURCE", new("At least one reservation exceeds its venue capacity.", "至少一項預訂超過場地容量。"));
            if (bookingsConfirmed) satisfiedOperationalRules.Add(("PLACE.RESOURCE", "bookings-confirmed"));
            else Add("PLACE.RESOURCE", new("Every scheduled occurrence needs a confirmed venue reservation.", "每個已排程場次都需要已確認的場地預訂。"));
            if (conflict is null) satisfiedOperationalRules.Add(("PLACE.RESOURCE", "conflicts-resolved"));
            else Add("PLACE.RESOURCE", new($"Venue reservation conflict at {conflict.StartUtc:yyyy-MM-dd HH:mm}Z–{conflict.EndUtc:yyyy-MM-dd HH:mm}Z.",
                $"場地預訂在 {conflict.StartUtc:yyyy-MM-dd HH:mm}Z–{conflict.EndUtc:yyyy-MM-dd HH:mm}Z 發生衝突。"));
        }

        if (plan.ModuleDecisions.Any(x => x.ModuleCode == "MOVE.STAY" &&
            x.Status is EventModuleDecisionStatus.Required or EventModuleDecisionStatus.Selected))
        {
            var journeys = await dbContext.EventTravelJourneys.AsNoTracking().Where(x => x.EventId == groupEvent.Id)
                .Include(x => x.EventOccurrence)
                .Include(x => x.Driver)
                .Include(x => x.Vehicle)
                .Include(x => x.PickupStops)
                .Include(x => x.PassengerAssignments)
                .ToListAsync(cancellationToken);
            var ram = await dbContext.EventRamAssessments.AsNoTracking().FirstOrDefaultAsync(x => x.EventId == groupEvent.Id, cancellationToken);
            var accommodationRequired = plan.Facts.Items.Any(x => x.Code == "move.accommodationRequired" &&
                x.Certainty == EventFactCertainty.Confirmed && x.Value is { } value && value.ValueKind == JsonValueKind.True);
            var travel = EventTravelReadiness.Evaluate(journeys, ram, accommodationRequired);
            foreach (var blocker in travel.Readiness.Blockers) Add("MOVE.STAY", blocker);
            if (travel.Readiness.TransportFactsConfirmed && travel.Readiness.RamTransportChecksComplete && !accommodationRequired)
                satisfiedOperationalRules.Add(("MOVE.STAY", "transport-and-stay-facts-confirmed"));
            if (travel.Readiness.DriversAndVehiclesQualified)
                satisfiedOperationalRules.Add(("MOVE.STAY", "drivers-and-vehicles-qualified"));
            if (travel.Readiness.PassengerManifestsComplete)
                satisfiedOperationalRules.Add(("MOVE.STAY", "manifests-and-night-roles-complete"));
        }

        if (plan.ModuleDecisions.Any(x => x.ModuleCode == "SAFEGUARDING.CHILD" &&
            x.Status is EventModuleDecisionStatus.Required or EventModuleDecisionStatus.Selected))
        {
            var configuration = await dbContext.EventSafeguardingConfigurations.AsNoTracking()
                .Include(x => x.PolicyVersion).FirstOrDefaultAsync(x => x.EventId == groupEvent.Id, cancellationToken);
            var children = await dbContext.EventChildRegistrations.AsNoTracking().Where(x => x.EventId == groupEvent.Id && x.IsActive)
                .Include(x => x.Guardians).Include(x => x.ConsentRecords).Include(x => x.AuthorisedCollectors)
                .ToListAsync(cancellationToken);
            var workerEvidence = await dbContext.EventSafeguardingWorkerEligibility.AsNoTracking()
                .Where(x => x.EventId == groupEvent.Id).ToListAsync(cancellationToken);
            var safeguarding = EventSafeguardingReadiness.Evaluate(configuration, children, roles, workerEvidence, checkedUtc);
            foreach (var blocker in safeguarding.Blockers) Add("SAFEGUARDING.CHILD", blocker);
            if (safeguarding.CurrentPolicyLoaded)
                satisfiedOperationalRules.Add(("SAFEGUARDING.CHILD", "current-policy-loaded"));
            if (safeguarding.GuardianshipComplete)
                satisfiedOperationalRules.Add(("SAFEGUARDING.CHILD", "guardianship-complete"));
            if (safeguarding.EligibleWorkersSatisfied)
                satisfiedOperationalRules.Add(("SAFEGUARDING.CHILD", "eligible-workers-and-policy-ratios-satisfied"));
        }

        var navigation = plan.Navigation.Select(item =>
        {
            var extra = item.ModuleCode is not null && additions.TryGetValue(item.ModuleCode, out var values) ? values : [];
            var blockers = item.Blockers.Where(blocker => !satisfiedOperationalRules.Any(satisfied =>
                satisfied.ModuleCode == item.ModuleCode && IsGenericReadinessBlocker(blocker, satisfied.RuleCode)))
                .Concat(extra).ToArray();
            return item with
            {
                Blockers = blockers,
                Readiness = blockers.Length == 0
                    ? item.Readiness == EventReadinessStatus.Complete ? EventReadinessStatus.Complete : EventReadinessStatus.Ready
                    : EventReadinessStatus.Blocked
            };
        }).ToArray();
        var allBlockers = plan.Readiness.Blockers.Where(blocker => !satisfiedOperationalRules.Any(satisfied =>
                IsGenericReadinessBlocker(blocker, satisfied.RuleCode)))
            .Concat(additions.Values.SelectMany(x => x)).ToArray();
        return plan with
        {
            Navigation = navigation,
            Readiness = plan.Readiness with
            {
                Status = allBlockers.Length == 0 ? EventReadinessStatus.Ready : EventReadinessStatus.Blocked,
                Blockers = allBlockers,
                CheckedUtc = checkedUtc
            }
        };
    }

    private static bool IsGenericReadinessBlocker(LocalizedTextDto blocker, string ruleCode)
        => blocker.En.EndsWith($"complete {ruleCode}.", StringComparison.Ordinal);

    public static EventRoleAssignmentDto ToDto(EventRoleAssignment assignment)
        => new(
            assignment.Id,
            assignment.EventId,
            assignment.RoleRequirementKey,
            assignment.MemberId,
            assignment.ScopeType,
            assignment.ScopeId,
            assignment.AssignedByMemberId,
            assignment.Status,
            assignment.AcceptedUtc,
            assignment.DeclinedUtc,
            assignment.EndedUtc,
            assignment.CreatedUtc,
            assignment.UpdatedUtc);

    public static void SyncWorkflowContributions(
        EventWorkflowRun? run,
        EventPlanProposalDto proposal,
        DateTime now)
    {
        if (run is null)
        {
            return;
        }

        var existing = run.Steps.Select(x => x.StepKey).ToHashSet(StringComparer.Ordinal);
        var sortOrder = run.Steps.Count == 0 ? 10 : run.Steps.Max(x => x.SortOrder) + 10;
        var requiredModules = proposal.ModuleDecisions
            .Where(x => x.Status == EventModuleDecisionStatus.Required)
            .Select(x => x.ModuleCode)
            .ToHashSet(StringComparer.Ordinal);
        foreach (var contribution in proposal.WorkflowContributions)
        {
            var stepKey = $"module.{contribution.StepKey}";
            if (!existing.Add(stepKey))
            {
                continue;
            }
            var label = contribution.StepKey.Replace('.', ' ').Replace('-', ' ');
            run.Steps.Add(new EventWorkflowStep
            {
                Id = Guid.NewGuid(),
                WorkflowRunId = run.Id,
                StepKey = stepKey,
                SortOrder = sortOrder,
                NameEn = label,
                NameZh = label,
                IsRequired = requiredModules.Contains(contribution.ModuleCode),
                RequiresApproval = false,
                IntegrationKey = contribution.IntegrationKey,
                Status = EventWorkflowStepStatus.NotStarted,
                CreatedUtc = now,
                UpdatedUtc = now
            });
            sortOrder += 10;
        }
        EventWorkflowDefinition.RecalculateRun(run, now);
    }

    private static EventPlanSnapshotDto CreateLegacySnapshot(EventPlanSnapshot snapshot)
    {
        var exists = new EventFactInputDto(
            "event.exists",
            JsonSerializer.SerializeToElement(true),
            EventFactCertainty.Confirmed,
            EventFactSource.LegacyBackfill);
        var team = EventCompositionDefinitions.ModulesByCode["TEAM.WORK"];
        var decision = new ModuleDecisionDto(
            team.Code, team.Version, team.Name, EventModuleDecisionStatus.Required,
            ["legacy-backfill", "policy-accountable-owner"], team.Dependencies, team.DataClasses,
            team.IntegrationKey, team.SurfaceKey, team.NavigationOrder);
        var warning = new LocalizedTextDto(
            "Review migrated event facts before relying on readiness.",
            "依賴準備度前，請先人工檢查已遷移的活動事實。");
        var blocker = new LocalizedTextDto(
            "Confirm the migrated event plan.",
            "確認已遷移的活動方案。");
        var plan = new EventPlanProposalDto(
            EventCompositionDefinitions.LegacySchemaVersion,
            snapshot.ProposalHash,
            snapshot.ETag,
            null,
            null,
            null,
            new EventFactSetDto(1, [exists], EventCompositionEngine.Hash(new[] { exists })),
            [decision],
            [new RoleRequirementDto(
                "TEAM.WORK:event.accountableOwner", "TEAM.WORK", "event.accountableOwner",
                1, 1, 1, ["owningGroupLeaderOrDelegate"], [])],
            team.WorkflowContributions.Select(x => new WorkflowContributionDto(team.Code, x, team.IntegrationKey)).ToArray(),
            new ReadinessDto(EventReadinessStatus.Blocked, [blocker], [warning], snapshot.CreatedUtc),
            [
                new EventWorkspaceItemDto("workspace.overview", null, "tab", "overview", null,
                    new LocalizedTextDto("Overview", "總覽"), 10, EventReadinessStatus.Blocked, [blocker], []),
                new EventWorkspaceItemDto("workspace.governance", null, "tab", "governance", null,
                    new LocalizedTextDto("Governance", "審批治理"), 15, EventReadinessStatus.Blocked, [blocker], []),
                new EventWorkspaceItemDto(team.SurfaceKey, team.Code, "tab", "team", null,
                    new LocalizedTextDto("Team", "團隊"), team.NavigationOrder, EventReadinessStatus.Blocked, [blocker], [])
            ],
            new EventPlanDiffDto([], [], [], []),
            [warning]);
        return new EventPlanSnapshotDto(
            snapshot.EventId, snapshot.Version, null, null, snapshot.ETag, true, plan, []);
    }

    private sealed record StoredEventPlanDocument(
        EventPlanProposalDto Plan,
        IReadOnlyList<HumanDecisionInput> HumanDecisions);
}
