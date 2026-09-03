using Alife.Application.Events.Dtos;
using Alife.Domain.Enums;

namespace Alife.Application.Events.Services;

public sealed record EventModuleActivationRule(
    string FactCode,
    string Operator,
    object ExpectedValue,
    EventModuleDecisionStatus Decision,
    string ReasonCode);

public sealed record EventRoleRequirementDefinition(
    string RoleCode,
    int Minimum,
    int Recommended,
    int? Maximum,
    IReadOnlyList<string> Eligibility,
    IReadOnlyList<string> SeparationFrom);

public sealed record EventSurfaceDefinition(
    string SurfaceKey,
    string? ModuleCode,
    string Presentation,
    string? SectionKey,
    string? PathSegment,
    int Order,
    string ComponentContract,
    LocalizedTextDto Label);

public sealed record EventModuleDefinition(
    string Code,
    int Version,
    LocalizedTextDto Name,
    IReadOnlyList<EventModuleActivationRule> ActivationRules,
    IReadOnlyList<string> Dependencies,
    IReadOnlyList<string> Conflicts,
    IReadOnlyList<EventRoleRequirementDefinition> RoleRequirements,
    IReadOnlyList<string> WorkflowContributions,
    IReadOnlyList<string> DataClasses,
    IReadOnlyList<string> ReadinessRules,
    string IntegrationKey,
    string SurfaceKey,
    int NavigationOrder);

public sealed record EventActivityTypeDefinition(
    string Code,
    int Version,
    string ArchetypeCode,
    LocalizedTextDto Name,
    LocalizedTextDto Description,
    string IconKey,
    EventActivityTypeDefaultsDto Defaults,
    IReadOnlyList<string> PreselectedModules,
    string? RecommendedWorkflowTemplateCode,
    IReadOnlyList<EventActivityTypeServiceSlotPresetDto> PresetServiceSlots)
{
    public EventActivityTypeDto ToDto() => new(
        Code, Version, ArchetypeCode, Name, Description, IconKey, Defaults,
        PreselectedModules, RecommendedWorkflowTemplateCode, PresetServiceSlots);
}

public static class EventCompositionDefinitions
{
    public const string SchemaVersion = "1.1.0";
    public const string LegacySchemaVersion = "1.0.0";
    public static readonly IReadOnlySet<string> ActivityTypeIconKeys = new HashSet<string>(
        ["meal", "people", "map", "outdoors", "camp", "retreat", "children", "training", "fellowship", "worship", "study", "prayer", "festival", "celebration", "outreach", "performance"],
        StringComparer.Ordinal);
    public static readonly IReadOnlySet<string> ActivityTypeWorkflowRecommendationCodes = new HashSet<string>(
        ["camp", "outreach"], StringComparer.Ordinal);

    public static readonly IReadOnlyList<EventModuleDefinition> Modules =
    [
        Module(
            "TEAM.WORK", "Team and work", "團隊與任務",
            [Rule("event.exists", "eq", true, EventModuleDecisionStatus.Required, "accountable-owner-required")],
            [],
            [Role("event.accountableOwner", 1, 1, 1, ["owningGroupLeaderOrDelegate"])],
            ["event.prepare", "event.deliver", "event.close"],
            ["eventTeam"], ["accountable-owner-assigned"], "workflow", "team.work", 20),
        Module(
            "PEOPLE.REGISTRATION", "Invitation and registration", "邀請與報名",
            [
                Rule("people.registrationMode", "neq", "none", EventModuleDecisionStatus.Required, "registration-enabled"),
                Rule("visibility", "eq", "public", EventModuleDecisionStatus.Recommended, "public-discovery")
            ],
            ["TEAM.WORK"],
            [Role("registration.manager", 1, 1, null, ["eventTeamMember"])],
            ["registration.configure", "registration.open", "registration.close", "attendance.reconcile"],
            ["churchOrGroupVisible", "roleRestricted", "userSpecific"],
            ["registration-window-valid", "capacity-defined", "privacy-notice-confirmed"],
            "registration", "people.registration", 30),
        Module(
            "SERVICE.ROSTER", "Service and rosters", "崗位與輪班",
            [Rule("people.volunteersRequired", "eq", true, EventModuleDecisionStatus.Required, "service-slots-required")],
            ["TEAM.WORK"],
            [Role("roster.coordinator", 1, 1, null, ["eventTeamMember"])],
            ["roster.define-demand", "roster.collect-availability", "roster.confirm", "roster.handle-substitutes"],
            ["eventTeam", "userSpecific"],
            ["required-slots-filled", "assignees-eligible", "assignees-confirmed"],
            "roster", "service.roster", 40),
        Module(
            "MONEY.FINANCE", "Finance", "財務",
            [Rule("money.hasMoneyFlow", "eq", true, EventModuleDecisionStatus.Required, "money-flow-present")],
            ["TEAM.WORK"],
            [
                Role("finance.owner", 1, 1, null, ["financeApproved"], ["finance.approver"]),
                Role("finance.approver", 1, 1, null, ["financeApprover"], ["finance.owner"])
            ],
            ["finance.budget", "finance.collect", "finance.purchase", "finance.reconcile", "finance.close"],
            ["roleRestricted", "approvalEvidence", "userSpecific"],
            ["currency-defined", "budget-approved", "payment-and-refund-terms-published"],
            "finance", "money.finance", 50),
        Module(
            "SAFETY.RAM", "RAM and safety", "RAM 與安全",
            [Rule("safety.requiresRam", "eq", true, EventModuleDecisionStatus.Required, "ram-policy-triggered")],
            ["TEAM.WORK"],
            [
                Role("ram.author", 1, 1, null, ["eventTeamMember"], ["ram.approver"]),
                Role("ram.approver", 1, 1, null, ["admin.events.audit"], ["ram.author"])
            ],
            ["ram.draft", "ram.submit", "ram.approve", "incident.record"],
            ["roleRestricted", "approvalEvidence"],
            ["ram-complete", "ram-submitted", "ram-approved"],
            "ram", "safety.ram", 60),
        Module(
            "SAFEGUARDING.CHILD", "Child safeguarding", "兒童保護",
            [Rule("people.childrenPresent", "eq", true, EventModuleDecisionStatus.Required, "children-present")],
            ["TEAM.WORK", "PEOPLE.REGISTRATION"],
            [
                Role("safeguarding.lead", 1, 1, null, ["childMinistryApproved"]),
                Role("check-in.worker", 0, 0, null, ["policyDefinedSafeguardingWorkerEligibility"])
            ],
            ["safeguarding.guardian-consent", "safeguarding.worker-check", "safeguarding.check-in-out", "safeguarding.escalate"],
            ["roleRestricted", "approvalEvidence"],
            ["current-policy-loaded", "guardianship-complete", "eligible-workers-and-policy-ratios-satisfied"],
            "safeguarding", "safeguarding.child", 70),
        Module(
            "PROGRAM.PRODUCTION", "Programme and production", "節目與製作",
            [Rule("programme.productionRequired", "eq", true, EventModuleDecisionStatus.Required, "managed-programme")],
            ["TEAM.WORK"],
            [Role("programme.lead", 1, 1, null, ["eventTeamMember"])],
            ["programme.build", "programme.confirm-content", "programme.rehearse", "programme.deliver"],
            ["eventTeam", "approvalEvidence"],
            ["programme-owner-assigned", "required-items-confirmed", "production-check-complete"],
            "programme", "program.production", 80),
        Module(
            "PLACE.RESOURCE", "Venue and resources", "場地與資源",
            [Rule("place.resourcesRequired", "eq", true, EventModuleDecisionStatus.Required, "managed-place-or-resource")],
            ["TEAM.WORK"],
            [Role("resource.coordinator", 1, 1, null, ["eventTeamMember"])],
            ["resource.reserve", "resource.prepare", "resource.handover", "resource.close"],
            ["eventTeam", "approvalEvidence"],
            ["capacity-sufficient", "bookings-confirmed", "conflicts-resolved"],
            "resource", "place.resource", 90),
        Module(
            "MOVE.STAY", "Transport and accommodation", "交通與住宿",
            [
                Rule("move.transportRequired", "eq", true, EventModuleDecisionStatus.Required, "transport-required"),
                Rule("move.accommodationRequired", "eq", true, EventModuleDecisionStatus.Required, "accommodation-required")
            ],
            ["TEAM.WORK"],
            [Role("travel.coordinator", 1, 1, null, ["eventTeamMember"])],
            ["travel.plan", "travel.verify-drivers", "stay.allocate", "travel.confirm-manifests"],
            ["eventTeam", "roleRestricted", "userSpecific"],
            ["transport-and-stay-facts-confirmed", "drivers-and-vehicles-qualified", "manifests-and-night-roles-complete"],
            "travel", "move.stay", 100),
        Module(
            "FOOD.HOSPITALITY", "Food and hospitality", "餐飲與接待",
            [Rule("food.serviceRequired", "eq", true, EventModuleDecisionStatus.Required, "food-service")],
            ["TEAM.WORK"],
            [Role("hospitality.lead", 1, 1, null, ["foodPolicyEligible"])],
            ["food.plan", "food.collect-dietary-needs", "food.prepare", "food.clean"],
            ["eventTeam", "roleRestricted"],
            ["food-policy-loaded", "allergy-process-confirmed", "service-and-cleaning-roles-filled"],
            "hospitality", "food.hospitality", 110),
        Module(
            "FESTIVAL.OPERATIONS", "Festival operations", "慶典現場營運",
            [Rule("scale.multiZone", "eq", true, EventModuleDecisionStatus.Required, "multi-zone-live-operation")],
            ["TEAM.WORK", "SAFETY.RAM", "PROGRAM.PRODUCTION", "PLACE.RESOURCE"],
            [Role("operations.commander", 1, 1, 1, ["eventCommandApproved"])],
            ["festival.zone-plan", "festival.command-plan", "festival.live-status", "festival.incident-escalation"],
            ["eventTeam", "roleRestricted", "approvalEvidence"],
            ["zone-leads-assigned", "command-and-escalation-confirmed", "evacuation-and-first-aid-confirmed"],
            "festival", "festival.operations", 120),
        Module(
            "COMMS.FOLLOWUP", "Communication and follow-up", "溝通與跟進",
            [
                Rule("comms.followupRequired", "eq", true, EventModuleDecisionStatus.Required, "followup-required"),
                Rule("event.exists", "eq", true, EventModuleDecisionStatus.Recommended, "event-communications")
            ],
            ["TEAM.WORK"],
            [Role("comms.owner", 1, 1, null, ["eventTeamMember"])],
            ["comms.notice", "comms.change-broadcast", "comms.follow-up", "comms.retention-review"],
            ["public", "churchOrGroupVisible", "roleRestricted", "userSpecific"],
            ["audience-and-channels-confirmed", "public-copy-approved-when-applicable", "retention-purpose-defined"],
            "followup", "comms.followup", 130)
    ];

    public static readonly IReadOnlyList<EventActivityTypeDefinition> ActivityTypes =
    [
        ActivityType("shared-meal", "simple-social", "Shared meal", "聚餐・BBQ",
            "A shared meal with registration and hospitality follow-up.", "需要報名、餐飲與後續聯絡的共享聚餐。",
            "meal", "groupVisible", "required",
            ["PEOPLE.REGISTRATION", "FOOD.HOSPITALITY", "SERVICE.ROSTER", "COMMS.FOLLOWUP"],
            [Slot("event.host", 1), Slot("hospitality.lead", 1), Slot("setup.team", 2), Slot("cleanup.team", 2)]),
        ActivityType("fellowship-social", "simple-social", "Fellowship social", "團契聯誼",
            "A low-complexity social gathering with optional attendance tracking.", "可按需要記錄出席的輕量團契聯誼。",
            "people", "groupVisible", "none",
            ["PEOPLE.REGISTRATION", "SERVICE.ROSTER", "COMMS.FOLLOWUP"],
            [Slot("event.host", 1), Slot("welcome.team", 2), Slot("setup.team", 2)]),
        ActivityType("local-outing", "simple-social", "Local outing", "一日外出",
            "A local day outing with registration, travel and safety planning.", "包含報名、交通與安全準備的一日外出。",
            "map", "groupVisible", "required",
            ["PEOPLE.REGISTRATION", "SAFETY.RAM", "MOVE.STAY", "SERVICE.ROSTER", "COMMS.FOLLOWUP"],
            [Slot("outing.lead", 1), Slot("checkin.team", 2), Slot("transport.coordinator", 1)]),
        ActivityType("outdoor-activity", "simple-social", "Outdoor activity", "戶外活動",
            "An outdoor activity with explicit travel and RAM review.", "需要明確交通與 RAM 檢視的戶外活動。",
            "outdoors", "groupVisible", "required",
            ["PEOPLE.REGISTRATION", "SAFETY.RAM", "MOVE.STAY", "SERVICE.ROSTER", "COMMS.FOLLOWUP"],
            [Slot("activity.lead", 1), Slot("checkin.team", 2), Slot("transport.coordinator", 1)]),

        ActivityType("church-camp", "camp-retreat", "Church camp", "全教會營會",
            "A multi-session whole-church camp with operational coordination.", "需要跨模組協作的多場次全教會營會。",
            "camp", "churchVisible", "required",
            ["PEOPLE.REGISTRATION", "SAFETY.RAM", "PROGRAM.PRODUCTION", "PLACE.RESOURCE", "MOVE.STAY", "FOOD.HOSPITALITY", "SERVICE.ROSTER", "COMMS.FOLLOWUP"],
            [Slot("camp.director", 1), Slot("registration.desk", 2), Slot("programme.team", 2), Slot("hospitality.team", 2), Slot("setup.team", 3)], "camp"),
        ActivityType("spiritual-retreat", "camp-retreat", "Spiritual retreat", "靈修退修會",
            "A retreat centred on programme, place, travel and hospitality.", "以節目、場地、交通與接待為核心的退修會。",
            "retreat", "churchVisible", "required",
            ["PEOPLE.REGISTRATION", "SAFETY.RAM", "PROGRAM.PRODUCTION", "PLACE.RESOURCE", "MOVE.STAY", "FOOD.HOSPITALITY", "SERVICE.ROSTER", "COMMS.FOLLOWUP"],
            [Slot("retreat.lead", 1), Slot("welcome.team", 2), Slot("programme.team", 2), Slot("hospitality.team", 2)], "camp"),
        ActivityType("children-youth-camp", "camp-retreat", "Children/youth camp", "兒童・青少年營",
            "A camp preset that surfaces safeguarding for explicit policy review.", "預選兒童保護並要求明確政策檢視的營會。",
            "children", "churchVisible", "required",
            ["PEOPLE.REGISTRATION", "SAFETY.RAM", "SAFEGUARDING.CHILD", "PROGRAM.PRODUCTION", "PLACE.RESOURCE", "MOVE.STAY", "FOOD.HOSPITALITY", "SERVICE.ROSTER", "COMMS.FOLLOWUP"],
            [Slot("camp.director", 1), Slot("registration.desk", 2), Slot("programme.team", 2), Slot("hospitality.team", 2)], "camp"),
        ActivityType("training-camp", "camp-retreat", "Training camp", "培訓營",
            "A training camp with programme, venue, roster and travel coordination.", "需要節目、場地、排班與交通協作的培訓營。",
            "training", "churchVisible", "required",
            ["PEOPLE.REGISTRATION", "SAFETY.RAM", "PROGRAM.PRODUCTION", "PLACE.RESOURCE", "MOVE.STAY", "FOOD.HOSPITALITY", "SERVICE.ROSTER", "COMMS.FOLLOWUP"],
            [Slot("training.lead", 1), Slot("registration.desk", 2), Slot("facilitator.team", 2), Slot("hospitality.team", 2)], "camp"),

        ActivityType("small-group-fellowship", "recurring-gathering", "Small-group fellowship", "小組團契",
            "A weekly group gathering with programme, place and follow-up.", "包含節目、場地與跟進的每週小組聚會。",
            "fellowship", "groupVisible", "none",
            ["PROGRAM.PRODUCTION", "PLACE.RESOURCE", "SERVICE.ROSTER", "COMMS.FOLLOWUP"],
            [Slot("gathering.host", 1), Slot("discussion.facilitator", 1), Slot("hospitality.host", 1)]),
        ActivityType("worship-service", "recurring-gathering", "Worship service", "主日聚會",
            "A recurring worship service with programme, venue and roster planning.", "包含節目、場地與排班規劃的定期崇拜。",
            "worship", "churchVisible", "none",
            ["PROGRAM.PRODUCTION", "PLACE.RESOURCE", "SERVICE.ROSTER", "COMMS.FOLLOWUP"],
            [Slot("service.lead", 1), Slot("welcome.team", 2), Slot("worship.team", 3), Slot("av.operator", 1)]),
        ActivityType("bible-study-course", "recurring-gathering", "Bible study/course", "查經課程",
            "A registered recurring course with programme and venue planning.", "需要報名、課程內容與場地規劃的定期課程。",
            "study", "churchVisible", "required",
            ["PEOPLE.REGISTRATION", "PROGRAM.PRODUCTION", "PLACE.RESOURCE", "SERVICE.ROSTER", "COMMS.FOLLOWUP"],
            [Slot("course.facilitator", 1), Slot("registration.desk", 1), Slot("hospitality.host", 1)]),
        ActivityType("prayer-meeting", "recurring-gathering", "Prayer meeting", "禱告會",
            "A recurring prayer gathering with programme and place coordination.", "包含流程與場地協作的定期禱告聚會。",
            "prayer", "groupVisible", "none",
            ["PROGRAM.PRODUCTION", "PLACE.RESOURCE", "SERVICE.ROSTER", "COMMS.FOLLOWUP"],
            [Slot("prayer.lead", 1), Slot("welcome.team", 1)]),

        ActivityType("community-festival", "festival-celebration", "Community festival", "社區節慶",
            "A public festival with zones, live operations and hospitality.", "包含區域、現場營運與接待的公開社區節慶。",
            "festival", "public", "none",
            ["PEOPLE.REGISTRATION", "SAFETY.RAM", "PROGRAM.PRODUCTION", "PLACE.RESOURCE", "FESTIVAL.OPERATIONS", "SERVICE.ROSTER", "FOOD.HOSPITALITY", "COMMS.FOLLOWUP"],
            [Slot("operations.commander", 1), Slot("welcome.team", 4), Slot("stage.team", 2), Slot("site.team", 4), Slot("hospitality.team", 3)]),
        ActivityType("church-celebration", "festival-celebration", "Church celebration", "教會慶典",
            "A church celebration with registration and coordinated live operations.", "需要報名與現場協作的教會慶典。",
            "celebration", "churchVisible", "required",
            ["PEOPLE.REGISTRATION", "SAFETY.RAM", "PROGRAM.PRODUCTION", "PLACE.RESOURCE", "FESTIVAL.OPERATIONS", "SERVICE.ROSTER", "FOOD.HOSPITALITY", "COMMS.FOLLOWUP"],
            [Slot("celebration.lead", 1), Slot("welcome.team", 3), Slot("programme.team", 2), Slot("setup.team", 4), Slot("hospitality.team", 3)]),
        ActivityType("public-outreach", "festival-celebration", "Public outreach", "公開外展",
            "A public outreach event with controlled outreach workflow recommendation.", "帶有受控 outreach 工作流建議的公開外展。",
            "outreach", "public", "none",
            ["PEOPLE.REGISTRATION", "SAFETY.RAM", "PROGRAM.PRODUCTION", "PLACE.RESOURCE", "FESTIVAL.OPERATIONS", "SERVICE.ROSTER", "COMMS.FOLLOWUP"],
            [Slot("outreach.lead", 1), Slot("welcome.team", 4), Slot("programme.team", 2), Slot("site.team", 4)], "outreach"),
        ActivityType("concert-performance", "festival-celebration", "Concert/performance", "音樂會・演出",
            "A public performance with registration and production operations.", "需要報名、製作與現場營運的公開演出。",
            "performance", "public", "required",
            ["PEOPLE.REGISTRATION", "SAFETY.RAM", "PROGRAM.PRODUCTION", "PLACE.RESOURCE", "FESTIVAL.OPERATIONS", "SERVICE.ROSTER", "COMMS.FOLLOWUP"],
            [Slot("production.lead", 1), Slot("front.of.house", 4), Slot("stage.team", 3), Slot("av.operator", 2), Slot("setup.team", 4)])
    ];

    public static readonly IReadOnlyList<EventArchetypeDto> Archetypes = BuildArchetypes(ActivityTypes);

    public static readonly IReadOnlyList<EventSurfaceDefinition> Surfaces =
    [
        Surface("workspace.overview", null, "tab", "overview", null, 10, "EventWorkspaceOverview", "Overview", "總覽"),
        Surface("workspace.governance", null, "tab", "governance", null, 15, "EventPackageGovernanceWorkspace", "Governance", "審批治理"),
        Surface("team.work", "TEAM.WORK", "tab", "team", null, 20, "EventTeamPanel", "Team", "團隊"),
        Surface("people.registration", "PEOPLE.REGISTRATION", "page", null, "registration", 30, "EventRegistrationWorkspace", "Registration", "報名"),
        Surface("service.roster", "SERVICE.ROSTER", "page", null, "roster", 40, "EventRosterWorkspace", "Roster", "排班"),
        Surface("money.finance", "MONEY.FINANCE", "page", null, "finance", 50, "EventFinanceWorkspace", "Finance", "財務"),
        Surface("safety.ram", "SAFETY.RAM", "page", null, "ram", 60, "EventRamWorkspace", "RAM & safety", "RAM 與安全"),
        Surface("safeguarding.child", "SAFEGUARDING.CHILD", "page", null, "safeguarding", 70, "EventSafeguardingWorkspace", "Child safeguarding", "兒童保護"),
        Surface("program.production", "PROGRAM.PRODUCTION", "tab", "programme", null, 80, "EventProgrammePanel", "Programme", "節目"),
        Surface("place.resource", "PLACE.RESOURCE", "tab", "resources", null, 90, "EventVenueWorkspaceSurface", "Resources", "資源"),
        Surface("move.stay", "MOVE.STAY", "page", null, "travel", 100, "EventTravelWorkspace", "Travel & stay", "交通住宿"),
        Surface("food.hospitality", "FOOD.HOSPITALITY", "tab", "hospitality", null, 110, "EventHospitalityPanel", "Hospitality", "餐飲接待"),
        Surface("festival.operations", "FESTIVAL.OPERATIONS", "page", null, "operations", 120, "EventOperationsWorkspace", "Operations", "現場營運"),
        Surface("comms.followup", "COMMS.FOLLOWUP", "page", null, "follow-up", 130, "EventFollowupWorkspace", "Follow-up", "溝通跟進")
    ];

    public static readonly IReadOnlyDictionary<string, EventModuleDefinition> ModulesByCode =
        Modules.ToDictionary(x => x.Code, StringComparer.Ordinal);

    public static readonly IReadOnlyDictionary<string, EventArchetypeDto> ArchetypesByCode =
        Archetypes.ToDictionary(x => x.Code, StringComparer.Ordinal);

    public static readonly IReadOnlyDictionary<string, EventActivityTypeDefinition> ActivityTypesByCode =
        ActivityTypes.ToDictionary(x => x.Code, StringComparer.Ordinal);

    public static readonly IReadOnlyDictionary<string, EventSurfaceDefinition> SurfacesByKey =
        Surfaces.ToDictionary(x => x.SurfaceKey, StringComparer.Ordinal);

    public static LocalizedTextDto ServiceSlotLabel(string roleCode)
        => ActivityTypes.SelectMany(x => x.PresetServiceSlots)
            .FirstOrDefault(x => string.Equals(x.RoleCode, roleCode, StringComparison.Ordinal))?.Label
            ?? Text(roleCode, roleCode);

    private static EventModuleDefinition Module(
        string code,
        string en,
        string zh,
        IReadOnlyList<EventModuleActivationRule> rules,
        IReadOnlyList<string> dependencies,
        IReadOnlyList<EventRoleRequirementDefinition> roles,
        IReadOnlyList<string> workflow,
        IReadOnlyList<string> dataClasses,
        IReadOnlyList<string> readiness,
        string integrationKey,
        string surfaceKey,
        int order)
        => new(code, 1, Text(en, zh), rules, dependencies, [], roles, workflow, dataClasses, readiness,
            integrationKey, surfaceKey, order);

    private static EventActivityTypeDefinition ActivityType(
        string code,
        string archetypeCode,
        string nameEn,
        string nameZh,
        string descriptionEn,
        string descriptionZh,
        string iconKey,
        string visibility,
        string registrationMode,
        IReadOnlyList<string> modules,
        IReadOnlyList<EventActivityTypeServiceSlotPresetDto> presetServiceSlots,
        string? workflow = null)
        => new(code, 2, archetypeCode, Text(nameEn, nameZh), Text(descriptionEn, descriptionZh), iconKey,
            new EventActivityTypeDefaultsDto(visibility, registrationMode, "People"), modules, workflow,
            presetServiceSlots);

    private static EventActivityTypeServiceSlotPresetDto Slot(string roleCode, int requiredCount)
        => new(roleCode, roleCode switch
        {
            "event.host" => Text("Event host", "活動主持"),
            "hospitality.lead" => Text("Hospitality lead", "餐飲負責人"),
            "setup.team" => Text("Setup team", "場地佈置團隊"),
            "cleanup.team" => Text("Cleanup team", "收拾團隊"),
            "welcome.team" => Text("Welcome team", "接待團隊"),
            "outing.lead" => Text("Outing lead", "外出領隊"),
            "checkin.team" => Text("Check-in team", "報到團隊"),
            "transport.coordinator" => Text("Transport coordinator", "交通協調員"),
            "activity.lead" => Text("Activity lead", "活動領隊"),
            "camp.director" => Text("Camp director", "營會總召"),
            "registration.desk" => Text("Registration desk", "報到處"),
            "programme.team" => Text("Programme team", "節目團隊"),
            "hospitality.team" => Text("Hospitality team", "餐飲團隊"),
            "retreat.lead" => Text("Retreat lead", "退修會帶領"),
            "training.lead" => Text("Training lead", "培訓負責人"),
            "facilitator.team" => Text("Facilitator team", "帶領團隊"),
            "gathering.host" => Text("Gathering host", "聚會接待"),
            "discussion.facilitator" => Text("Discussion facilitator", "討論帶領"),
            "hospitality.host" => Text("Hospitality host", "茶點接待"),
            "service.lead" => Text("Service lead", "聚會主領"),
            "worship.team" => Text("Worship team", "敬拜團隊"),
            "av.operator" => Text("Audio/visual operator", "音響影像操作"),
            "course.facilitator" => Text("Course facilitator", "課程帶領"),
            "prayer.lead" => Text("Prayer lead", "禱告帶領"),
            "operations.commander" => Text("Operations commander", "現場總指揮"),
            "stage.team" => Text("Stage team", "舞台團隊"),
            "site.team" => Text("Site team", "場務團隊"),
            "celebration.lead" => Text("Celebration lead", "慶典負責人"),
            "outreach.lead" => Text("Outreach lead", "外展負責人"),
            "production.lead" => Text("Production lead", "製作負責人"),
            "front.of.house" => Text("Front of house", "前台接待"),
            _ => Text(roleCode, roleCode)
        }, requiredCount, "approvedGroupMember");

    public static IReadOnlyList<EventArchetypeDto> BuildArchetypes(
        IEnumerable<EventActivityTypeDefinition> activityTypes)
    {
        var types = activityTypes.ToArray();
        IReadOnlyList<EventActivityTypeDto> TypesFor(string archetypeCode)
            => types.Where(x => x.ArchetypeCode == archetypeCode).Select(x => x.ToDto()).ToArray();

        return
        [
            new("simple-social", 1, Text("Simple social / outing", "簡單社交／外出"), false, 1, null, false, false,
                ["TEAM.WORK"], ["PEOPLE.REGISTRATION", "COMMS.FOLLOWUP"],
                ["SAFETY.RAM", "MOVE.STAY", "FOOD.HOSPITALITY", "SAFEGUARDING.CHILD"], [], TypesFor("simple-social")),
            new("camp-retreat", 1, Text("Camp / retreat", "營會／退修會"), false, 1, null, true, false,
                ["TEAM.WORK", "PEOPLE.REGISTRATION", "SAFETY.RAM", "PROGRAM.PRODUCTION", "MOVE.STAY"],
                ["COMMS.FOLLOWUP", "PLACE.RESOURCE"],
                ["MONEY.FINANCE", "SAFEGUARDING.CHILD", "FOOD.HOSPITALITY", "SERVICE.ROSTER"], ["camp"], TypesFor("camp-retreat")),
            new("recurring-gathering", 1, Text("Recurring gathering", "定期聚會"), true, 0, 12, true, false,
                ["TEAM.WORK", "PROGRAM.PRODUCTION"], ["SERVICE.ROSTER", "COMMS.FOLLOWUP"],
                ["PEOPLE.REGISTRATION", "SAFEGUARDING.CHILD", "PLACE.RESOURCE", "FOOD.HOSPITALITY", "SAFETY.RAM"], [], TypesFor("recurring-gathering")),
            new("festival-celebration", 1, Text("Festival / celebration", "節日慶典"), false, 1, null, true, true,
                ["TEAM.WORK", "PEOPLE.REGISTRATION", "SAFETY.RAM", "PROGRAM.PRODUCTION", "PLACE.RESOURCE", "FESTIVAL.OPERATIONS"],
                ["SERVICE.ROSTER", "COMMS.FOLLOWUP"],
                ["MONEY.FINANCE", "SAFEGUARDING.CHILD", "MOVE.STAY", "FOOD.HOSPITALITY"], [], TypesFor("festival-celebration"))
        ];
    }

    private static EventModuleActivationRule Rule(
        string fact,
        string op,
        object expected,
        EventModuleDecisionStatus decision,
        string reason)
        => new(fact, op, expected, decision, reason);

    private static EventRoleRequirementDefinition Role(
        string code,
        int minimum,
        int recommended,
        int? maximum,
        IReadOnlyList<string> eligibility,
        IReadOnlyList<string>? separation = null)
        => new(code, minimum, recommended, maximum, eligibility, separation ?? []);

    private static EventSurfaceDefinition Surface(
        string key,
        string? module,
        string presentation,
        string? section,
        string? path,
        int order,
        string component,
        string en,
        string zh)
        => new(key, module, presentation, section, path, order, component, Text(en, zh));

    private static LocalizedTextDto Text(string en, string zh) => new(en, zh);
}
