using System.Text.Json;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Application.Rosters;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Queries.GetEventPlan;

public sealed class GetEventPlanQueryHandler(IAlifeDbContext db, IGroupAuthorizationService authorization)
    : IRequestHandler<GetEventPlanQuery, AppResult<EventPlanDto>>
{
    public async Task<AppResult<EventPlanDto>> Handle(GetEventPlanQuery request, CancellationToken cancellationToken)
    {
        var groupEvent = await db.GroupEvents.AsNoTracking()
            .Include(x => x.RamAssessment)
            .Include(x => x.VenueBookings)
            .Include(x => x.RosterShifts).ThenInclude(x => x.Assignments)
            .Include(x => x.ProgrammeItems).ThenInclude(x => x.OwnerMember)
            .Include(x => x.ProgrammeItems).ThenInclude(x => x.RosterShift).ThenInclude(x => x!.Assignments).ThenInclude(x => x.Member)
            .Include(x => x.PreparationTasks).ThenInclude(x => x.AssignedMember)
            .Include(x => x.PreparationTasks).ThenInclude(x => x.Dependencies).ThenInclude(x => x.DependsOnTask)
            .Include(x => x.ClosureReport)
            .Include(x => x.Plan).ThenInclude(x => x!.Occurrences)
            .Include(x => x.Plan).ThenInclude(x => x!.Modules)
            .Include(x => x.Plan).ThenInclude(x => x!.ReadinessGates)
            .Include(x => x.Plan).ThenInclude(x => x!.Decisions).ThenInclude(x => x.RequestedByMember)
            .Include(x => x.Plan).ThenInclude(x => x!.Decisions).ThenInclude(x => x.DecidedByMember)
            .FirstOrDefaultAsync(x => x.Id == request.EventId, cancellationToken);
        if (groupEvent is null) return AppResult<EventPlanDto>.NotFound("Event not found.");
        if (!await authorization.IsLeaderOrCoLeaderAsync(groupEvent.GroupId, request.CurrentMemberId, cancellationToken))
            return AppResult<EventPlanDto>.Forbidden("Only event leaders can view the preparation plan.");

        var legacyProjection = groupEvent.Plan is null;
        var plan = groupEvent.Plan ?? EventCompositionFactory.CreateInitial(
            groupEvent,
            request.CurrentMemberId,
            groupEvent.RamAssessment?.RamDataJson,
            groupEvent.UpdatedUtc);
        var enrollmentPayloads = await db.EventEnrollments.AsNoTracking()
            .Where(x => x.EventId == groupEvent.Id)
            .Select(x => x.EnrollmentJson)
            .ToListAsync(cancellationToken);
        var approvalMemberIds = groupEvent.VenueBookings
            .SelectMany(x => new Guid?[] { x.RequestedByMemberId, x.SubmittedByMemberId, x.ReviewedByMemberId })
            .Concat(new Guid?[] { groupEvent.RamAssessment?.SubmittedByMemberId, groupEvent.RamAssessment?.ApprovedByMemberId })
            .Where(x => x.HasValue)
            .Select(x => x!.Value)
            .Distinct()
            .ToArray();
        var approvalMemberNames = await db.Members.AsNoTracking()
            .Where(x => approvalMemberIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, x => x.DisplayName, cancellationToken);
        var attendanceRecorded = enrollmentPayloads.Count == 0 || await db.EventAttendanceRecords.AsNoTracking()
            .AnyAsync(x => x.EventId == groupEvent.Id, cancellationToken);
        var financeReconciled = await db.EventFinanceReconciliations.AsNoTracking()
            .AnyAsync(x => x.EventId == groupEvent.Id && x.LeaderConfirmed, cancellationToken);
        return AppResult<EventPlanDto>.Success(ToDto(
            plan, groupEvent, legacyProjection, enrollmentPayloads, approvalMemberNames,
            attendanceRecorded, financeReconciled));
    }

    private static EventPlanDto ToDto(
        EventPlan plan,
        GroupEvent groupEvent,
        bool legacyProjection,
        IReadOnlyCollection<string> enrollmentPayloads,
        IReadOnlyDictionary<Guid, string?> approvalMemberNames,
        bool attendanceRecorded,
        bool financeReconciled)
    {
        var now = DateTime.UtcNow;
        // Preparation modules are projections of real work. The plan page must not report a
        // venue or RAM as ready merely because a module row exists.
        var moduleRequirements = plan.Modules.ToDictionary(
            x => x.Id,
            x => x.IsRequired || (x.ModuleKey == "closure" && groupEvent.EndDate <= DateTime.UtcNow));
        var moduleStatuses = plan.Modules.ToDictionary(
            x => x.Id,
            x => EffectiveModuleStatus(x, groupEvent, moduleRequirements[x.Id], now));
        var gates = plan.ReadinessGates.OrderBy(x => x.GateKey).Select(x =>
        {
            var status = x.Status;
            var name = new WorkflowTextDto(x.NameEn, x.NameZh);
            if (x.ModuleInstanceId is Guid moduleId && moduleStatuses.TryGetValue(moduleId, out var moduleStatus))
            {
                status = moduleStatus switch
                {
                    EventModuleStatus.Ready or EventModuleStatus.Completed => EventReadinessStatus.Satisfied,
                    EventModuleStatus.Blocked => EventReadinessStatus.Blocked,
                    _ => EventReadinessStatus.Pending
                };
                if (plan.Modules.FirstOrDefault(module => module.Id == moduleId)?.ModuleKey == "communications")
                    name = new WorkflowTextDto("Confirm the activity notice", "确认活动通知");
            }
            return new EventReadinessGateDto(
                x.Id, x.ModuleInstanceId, x.GateKey, name,
                x.ModuleInstanceId is Guid requiredModuleId && moduleRequirements.TryGetValue(requiredModuleId, out var isRequired)
                    ? isRequired : x.IsRequired,
                status, x.ExplanationJson);
        }).ToArray();
        var requiredGates = gates.Where(x => x.IsRequired).ToArray();
        var allRequiredSatisfied = requiredGates.All(x => x.Status is EventReadinessStatus.Satisfied or EventReadinessStatus.Waived);
        var effectivePlanStatus = plan.Status == EventPlanStatus.Cancelled
            ? plan.Status
            : groupEvent.EndDate <= DateTime.UtcNow && allRequiredSatisfied
                ? EventPlanStatus.Completed
                : allRequiredSatisfied ? EventPlanStatus.Ready : EventPlanStatus.Active;

        return new EventPlanDto(
            plan.Id,
            plan.EventId,
            plan.CurrentRevision,
            effectivePlanStatus,
            legacyProjection,
            plan.UpdatedUtc,
            groupEvent.StartDate,
            groupEvent.EndDate,
            plan.Occurrences.OrderBy(x => x.SortOrder).Select(x => new EventPlanOccurrenceDto(
                x.Id, x.OccurrenceKey, new WorkflowTextDto(x.NameEn, x.NameZh), x.StartUtc, x.EndUtc, x.TimeZoneId, x.SortOrder)).ToArray(),
            plan.Modules.OrderBy(x => x.ModuleKey).Select(x => new EventPlanModuleDto(
                x.Id, x.ModuleKey, x.ModuleVersion, moduleRequirements[x.Id], moduleStatuses[x.Id])).ToArray(),
            gates,
            plan.Decisions.OrderByDescending(x => x.RequestedUtc).Select(x => new EventPlanDecisionDto(
                x.Id,
                x.ModuleInstanceId,
                x.DecisionKey,
                x.Status,
                x.RequestedByMemberId,
                x.RequestedByMember?.DisplayName,
                x.DecidedByMemberId,
                x.DecidedByMember?.DisplayName,
                x.DecisionNotes,
                x.RequestedUtc,
                x.DecidedUtc)).ToArray(),
            ApprovalItems(plan, groupEvent, approvalMemberNames),
            Milestones(plan, groupEvent, moduleStatuses, moduleRequirements, attendanceRecorded, financeReconciled, enrollmentPayloads.Count > 0, now),
            PreparationTaskSummary(groupEvent, now),
            RegistrationSummary(groupEvent, enrollmentPayloads));
    }

    private static IReadOnlyList<EventPlanMilestoneDto> Milestones(
        EventPlan plan,
        GroupEvent groupEvent,
        IReadOnlyDictionary<Guid, EventModuleStatus> moduleStatuses,
        IReadOnlyDictionary<Guid, bool> moduleRequirements,
        bool attendanceRecorded,
        bool financeReconciled,
        bool hasEnrollments,
        DateTime now)
    {
        var selected = plan.Modules.Where(x => moduleRequirements[x.Id]).ToDictionary(x => x.ModuleKey, StringComparer.Ordinal);
        EventPlanMilestoneCheckDto ModuleCheck(string key, string en, string zh)
        {
            var module = selected.GetValueOrDefault(key);
            var status = module is null ? "notApplicable" : moduleStatuses[module.Id] switch
            {
                EventModuleStatus.Ready or EventModuleStatus.Completed => "satisfied",
                EventModuleStatus.Blocked => "blocked",
                _ => "pending"
            };
            return new EventPlanMilestoneCheckDto(key, new WorkflowTextDto(en, zh), status, module is null ? null : key);
        }
        static EventPlanMilestoneCheckDto FactCheck(string key, string en, string zh, bool satisfied, string? moduleKey = null)
            => new(key, new WorkflowTextDto(en, zh), satisfied ? "satisfied" : "pending", moduleKey);
        static string Status(IReadOnlyCollection<EventPlanMilestoneCheckDto> checks, bool applicable = true)
            => !applicable ? "notApplicable"
                : checks.Any(x => x.Status == "blocked") ? "blocked"
                : checks.All(x => x.Status is "satisfied" or "notApplicable") ? "ready"
                : "pending";

        var announceChecks = new[]
        {
            ModuleCheck("core", "Basic details, visibility and time are valid", "基本资料、可见范围和时间有效"),
            FactCheck("location", "Provide a usable activity location", "说明一个可用的活动地点",
                HasLocalizedFact(groupEvent.EventDataJson, "locationName")
                || (selected.TryGetValue("venue", out var venue) && moduleStatuses[venue.Id] is EventModuleStatus.Ready or EventModuleStatus.Completed),
                selected.ContainsKey("venue") ? "venue" : "core"),
            ModuleCheck("communications", "Confirm bilingual activity information for publication", "确认双语活动内容可对外展示")
        };
        var registrationSelected = selected.ContainsKey("registration");
        var registrationChecks = registrationSelected
            ? new[]
            {
                FactCheck("announcement", "The activity can be announced", "活动已经可以预告", Status(announceChecks) == "ready", "communications"),
                ModuleCheck("registration", "Capacity and registration deadline are ready", "容量和报名截止时间已经就绪"),
                ModuleCheck("finance", "Participant charges and refund rules are confirmed when needed", "需要收费时，费用和退款规则已经确认")
            }
            : [];
        var executionChecks = new List<EventPlanMilestoneCheckDto>
        {
            ModuleCheck("core", "Event facts and time remain valid", "活动资料和时间仍然有效")
        };
        foreach (var key in new[] { "venue", "registration", "finance", "ram", "roster", "programme" })
        {
            if (!selected.ContainsKey(key)) continue;
            executionChecks.Add(ModuleCheck(key, key switch
            {
                "venue" => "Venue reservation is approved",
                "registration" => "Registration settings are ready",
                "finance" => "Finance settings are confirmed",
                "ram" => "Risk controls are approved",
                "roster" => "Required roster positions are accepted",
                "programme" => "Programme timing, owners and handovers are confirmed",
                _ => "Required preparation tasks are complete"
            }, key switch
            {
                "venue" => "场地预留已经批准",
                "registration" => "报名设置已经就绪",
                "finance" => "费用设置已经确认",
                "ram" => "风险控制已经批准",
                "roster" => "必要岗位已经由成员接受",
                "programme" => "程序时间、负责人和交接说明已经确认",
                _ => "必要筹备任务已经完成"
            }));
        }
        if (selected.ContainsKey(EventPreparationPlanSync.ModuleKey))
        {
            var requiredTasks = EventPreparationTaskPolicy.RequiredTasks(groupEvent.PreparationTasks);
            EventPlanMilestoneCheckDto TaskCheck(string key, string en, string zh, bool satisfied, bool blockedWhenMissing = true) =>
                new(key, new WorkflowTextDto(en, zh), satisfied ? "satisfied" : blockedWhenMissing ? "blocked" : "pending", EventPreparationPlanSync.ModuleKey);
            executionChecks.Add(TaskCheck("taskOwners", "Every required task has an owner", "每项必要任务都有负责人",
                requiredTasks.All(x => x.AssignedMemberId is not null)));
            executionChecks.Add(TaskCheck("taskDueDates", "Every required task has a due date before the event", "每项必要任务都有活动开始前的截止时间",
                requiredTasks.All(x => x.DueUtc is not null && !EventPreparationTaskPolicy.IsDueAfterEvent(x, groupEvent.StartDate))));
            executionChecks.Add(TaskCheck("taskOverdue", "No required task is overdue", "没有已经逾期的必要任务",
                requiredTasks.All(x => !EventPreparationTaskPolicy.IsOverdue(x, now))));
            executionChecks.Add(TaskCheck("taskDependencies", "No required task is waiting for a prerequisite", "必要任务没有被前置任务阻塞",
                requiredTasks.All(x => !EventPreparationTaskPolicy.IsBlocked(x))));
            executionChecks.Add(TaskCheck("tasks", "Required preparation tasks are complete", "必要筹备任务已经完成",
                requiredTasks.All(x => x.Status == EventPreparationTaskStatus.Completed), false));
        }
        var financeSelected = selected.ContainsKey("finance");
        var closureChecks = new[]
        {
            FactCheck("eventEnded", "The event has ended", "活动已经结束", groupEvent.EndDate <= now),
            FactCheck("attendance", "Actual attendance is recorded when registrations exist", "有报名记录时，已经核对实际出席", !hasEnrollments || attendanceRecorded, "closure"),
            FactCheck("financeActuals", "Actual finances are reconciled when finance is used", "使用费用模块时，实际收支已经完成对账", !financeSelected || financeReconciled, financeSelected ? "finance" : null),
            ModuleCheck("closure", "The leader confirmed closure and follow-up", "负责人已经确认总结和跟进事项")
        };
        return
        [
            new EventPlanMilestoneDto("announce", new WorkflowTextDto("Can announce", "可以预告"), Status(announceChecks), announceChecks),
            new EventPlanMilestoneDto("register", new WorkflowTextDto("Can open registration", "可以开放报名"), Status(registrationChecks, registrationSelected), registrationChecks),
            new EventPlanMilestoneDto("run", new WorkflowTextDto("Can run the event", "可以举办"), Status(executionChecks), executionChecks),
            new EventPlanMilestoneDto("close", new WorkflowTextDto("Can close the event", "可以结项"), Status(closureChecks), closureChecks)
        ];
    }

    private static IReadOnlyList<EventPlanApprovalItemDto> ApprovalItems(
        EventPlan plan,
        GroupEvent groupEvent,
        IReadOnlyDictionary<Guid, string?> memberNames)
    {
        var items = new List<EventPlanApprovalItemDto>();
        var venueModule = plan.Modules.FirstOrDefault(x => x.IsRequired && x.ModuleKey == "venue");
        if (venueModule is not null)
        {
            var bookings = groupEvent.VenueBookings
                .Where(x => x.Status != VenueBookingStatus.Cancelled)
                .OrderBy(x => x.StartUtc)
                .ThenBy(x => x.CreatedUtc)
                .ToArray();
            if (bookings.Length == 0)
            {
                items.Add(new EventPlanApprovalItemDto(
                    "venue.booking.approval", null, venueModule.Id,
                    new WorkflowTextDto("Venue reservation", "场地预留"), "notStarted",
                    null, null, null, null, string.Empty, null, null));
            }
            else
            {
                items.AddRange(bookings.Select(x => new EventPlanApprovalItemDto(
                    "venue.booking.approval", x.Id, venueModule.Id,
                    new WorkflowTextDto(x.PurposeEn, x.PurposeZh), VenueApprovalStatus(x.Status),
                    x.SubmittedByMemberId ?? x.RequestedByMemberId, MemberName(memberNames, x.SubmittedByMemberId ?? x.RequestedByMemberId),
                    x.ReviewedByMemberId, MemberName(memberNames, x.ReviewedByMemberId),
                    x.DecisionNotes, x.SubmittedUtc, x.ReviewedUtc)));
            }
        }

        var ramModule = plan.Modules.FirstOrDefault(x => x.IsRequired && x.ModuleKey == "ram");
        if (ramModule is not null)
        {
            var decision = EventRamDecisionPolicy.Latest(plan);
            var ram = groupEvent.RamAssessment;
            items.Add(new EventPlanApprovalItemDto(
                EventRamDecisionPolicy.DecisionKey, groupEvent.Id, ramModule.Id,
                new WorkflowTextDto("RAM controls for this event", "本次活动的风险控制"),
                RamApprovalStatus(decision?.Status, ram?.Status),
                decision?.RequestedByMemberId ?? ram?.SubmittedByMemberId,
                decision?.RequestedByMember?.DisplayName ?? MemberName(memberNames, ram?.SubmittedByMemberId),
                decision?.DecidedByMemberId ?? ram?.ApprovedByMemberId,
                decision?.DecidedByMember?.DisplayName ?? MemberName(memberNames, ram?.ApprovedByMemberId),
                decision?.DecisionNotes ?? string.Empty,
                decision?.RequestedUtc ?? ram?.SubmittedUtc,
                decision?.DecidedUtc ?? ram?.ApprovedUtc));
        }
        return items;
    }

    private static string? MemberName(IReadOnlyDictionary<Guid, string?> memberNames, Guid? memberId)
        => memberId.HasValue && memberNames.TryGetValue(memberId.Value, out var name) ? name : null;

    private static string VenueApprovalStatus(VenueBookingStatus status) => status switch
    {
        VenueBookingStatus.Draft => "draft",
        VenueBookingStatus.Submitted => "requested",
        VenueBookingStatus.Approved => "approved",
        VenueBookingStatus.Rejected => "rejected",
        _ => "cancelled"
    };

    private static string RamApprovalStatus(EventDecisionStatus? decisionStatus, EventRamStatus? ramStatus)
    {
        if (decisionStatus.HasValue)
        {
            return decisionStatus.Value switch
            {
                EventDecisionStatus.Requested => "requested",
                EventDecisionStatus.Approved => "approved",
                EventDecisionStatus.Returned => "returned",
                EventDecisionStatus.Rejected => "rejected",
                _ => "cancelled"
            };
        }
        return ramStatus switch
        {
            EventRamStatus.AwaitingReview => "requested",
            EventRamStatus.Approved => "approved",
            _ => "draft"
        };
    }

    private static EventModuleStatus EffectiveModuleStatus(EventModuleInstance module, GroupEvent groupEvent, bool isRequired, DateTime now)
    {
        if (!isRequired) return module.Status;
        return module.ModuleKey switch
        {
            "core" => EventCorePolicy.ModuleStatus(groupEvent),
            "communications" => HasLocalizedFact(groupEvent.EventDataJson, "description")
                && EventVisibilityPolicy.IsPublicationConfirmed(
                    groupEvent.EventDataJson,
                    groupEvent.RamAssessment?.Status ?? EventRamStatus.Draft)
                ? EventModuleStatus.Ready
                : EventModuleStatus.NotConfigured,
            "registration" => RegistrationModuleStatus(groupEvent),
            "finance" => EventFinancePolicy.ModuleStatus(groupEvent),
            "ram" => groupEvent.RamAssessment?.Status switch
            {
                EventRamStatus.Approved => EventModuleStatus.Ready,
                EventRamStatus.AwaitingReview => EventModuleStatus.Configuring,
                EventRamStatus.Draft when EventRamDecisionPolicy.Latest(groupEvent.Plan)?.Status
                    is EventDecisionStatus.Returned or EventDecisionStatus.Rejected => EventModuleStatus.Blocked,
                _ => EventModuleStatus.NotConfigured
            },
            "venue" => LatestVenueStatus(groupEvent),
            "roster" => RosterPolicy.RosterModuleStatus(groupEvent.RosterShifts),
            "programme" => EventProgrammePolicy.ModuleStatus(groupEvent.ProgrammeItems),
            "tasks" => EventPreparationTaskPolicy.ModuleStatus(groupEvent.PreparationTasks, groupEvent.StartDate, now),
            "closure" => EventClosurePolicy.ModuleStatus(groupEvent),
            _ => module.Status
        };
    }

    private static EventPlanPreparationTaskSummaryDto? PreparationTaskSummary(GroupEvent groupEvent, DateTime now)
    {
        var tasks = EventPreparationTaskPolicy.RequiredTasks(groupEvent.PreparationTasks);
        if (tasks.Length == 0) return null;
        var nextTasks = tasks
            .Where(x => x.Status != EventPreparationTaskStatus.Completed)
            .OrderByDescending(x => EventPreparationTaskPolicy.IsOverdue(x, now))
            .ThenBy(x => x.DueUtc ?? DateTime.MaxValue)
            .ThenBy(x => x.CreatedUtc)
            .Take(5)
            .Select(x => new EventPlanPreparationTaskItemDto(
                x.Id,
                x.ModuleKey,
                new WorkflowTextDto(x.TitleEn, x.TitleZh),
                x.AssignedMemberId,
                x.AssignedMember?.DisplayName,
                x.DueUtc,
                x.Status,
                EventPreparationTaskPolicy.IsBlocked(x)))
            .ToArray();
        return new EventPlanPreparationTaskSummaryDto(
            tasks.Length,
            tasks.Count(x => x.Status == EventPreparationTaskStatus.Completed),
            tasks.Count(x => x.AssignedMemberId is null),
            tasks.Count(x => x.DueUtc is null),
            tasks.Count(x => EventPreparationTaskPolicy.IsDueAfterEvent(x, groupEvent.StartDate)),
            tasks.Count(x => EventPreparationTaskPolicy.IsOverdue(x, now)),
            tasks.Count(EventPreparationTaskPolicy.IsBlocked),
            nextTasks);
    }

    private static EventModuleStatus RegistrationModuleStatus(GroupEvent groupEvent)
    {
        if (!EventRegistrationPolicy.TryReadSettings(groupEvent, out var settings, out _))
            return EventModuleStatus.Blocked;
        if (!settings.IsConfigured) return EventModuleStatus.NotConfigured;
        return settings.RegistrationDeadlineUtc!.Value.UtcDateTime > groupEvent.StartDate
            ? EventModuleStatus.Blocked
            : EventModuleStatus.Ready;
    }

    private static EventPlanRegistrationSummaryDto? RegistrationSummary(
        GroupEvent groupEvent,
        IReadOnlyCollection<string> enrollmentPayloads)
    {
        if (!EventRegistrationPolicy.TryReadSettings(groupEvent, out var settings, out _)) return null;
        var reserved = EventRegistrationPolicy.CountReservedUnits(enrollmentPayloads, settings.CapacityUnit);
        var remaining = Math.Max(0, settings.MaxCapacity - reserved);
        var state = !settings.IsConfigured
            ? "notConfigured"
            : settings.RegistrationDeadlineUtc!.Value.UtcDateTime > groupEvent.StartDate
                ? "invalid"
                : reserved >= settings.MaxCapacity
                    ? "full"
                    : settings.RegistrationDeadlineUtc.Value.UtcDateTime < DateTime.UtcNow
                        ? "closed"
                        : "open";
        return new EventPlanRegistrationSummaryDto(
            settings.MaxCapacity,
            settings.CapacityUnit,
            enrollmentPayloads.Count,
            reserved,
            remaining,
            settings.RegistrationDeadlineUtc?.UtcDateTime,
            state);
    }

    private static EventModuleStatus LatestVenueStatus(GroupEvent groupEvent)
    {
        var activeBookings = groupEvent.VenueBookings
            .Where(x => x.Status != VenueBookingStatus.Cancelled)
            .ToArray();
        if (activeBookings.Length == 0) return EventModuleStatus.NotConfigured;
        if (activeBookings.Any(x => x.Status == VenueBookingStatus.Rejected)) return EventModuleStatus.Blocked;
        if (activeBookings.All(x => x.Status == VenueBookingStatus.Approved)) return EventModuleStatus.Ready;
        return EventModuleStatus.Configuring;
    }

    private static bool HasLocalizedFact(string json, string propertyName)
    {
        try
        {
            using var document = JsonDocument.Parse(json);
            return document.RootElement.TryGetProperty(propertyName, out var value)
                && value.ValueKind == JsonValueKind.Object
                && value.EnumerateObject().Any(x => x.Value.ValueKind == JsonValueKind.String
                    && !string.IsNullOrWhiteSpace(x.Value.GetString()));
        }
        catch (JsonException)
        {
            return false;
        }
    }
}
