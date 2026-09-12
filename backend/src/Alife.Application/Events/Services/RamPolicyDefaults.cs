using Alife.Application.Events.Dtos;

namespace Alife.Application.Events.Services;

public static class RamPolicyDefaults
{
    public static readonly string[] CategoryCodes = ["environment", "activity", "participants", "transport", "emergency"];
    public static readonly string[] ActivityTypes = ["generic", "hiking", "water", "sport", "transport", "camp", "meal", "outdoor", "other"];
    private static RamText T(string en, string zh) => new(en, zh);
    public static RamPolicyData Create() => new(
        [
            new(1,T("Rare", "极少"),T("Less than 5% chance of occurring.", "发生机会低于 5%。")),
            new(2,T("Unlikely", "不太可能"),T("5–29% chance of occurring.", "发生机会为 5–29%。")),
            new(3,T("Moderate", "中等"),T("30–59% chance of occurring.", "发生机会为 30–59%。")),
            new(4,T("Likely", "很可能"),T("60–79% chance of occurring.", "发生机会为 60–79%。")),
            new(5,T("Almost certain", "几乎肯定"),T("80% or greater chance of occurring.", "发生机会为 80% 或以上。"))
        ],
        [
            new(1,T("Negligible", "可忽略"),T("Minor discomfort or negligible injury.", "轻微不适或可忽略的伤害。")),
            new(2,T("Minor", "轻微"),T("Basic first aid; recovery in less than one week.", "基本急救；恢复时间少于一周。")),
            new(3,T("Moderate", "中等"),T("Advanced first aid or medical visit; recovery in 1–6 weeks.", "进阶急救或就医；恢复时间为 1–6 周。")),
            new(4,T("Major", "严重"),T("Hospital or emergency treatment; recovery longer than six weeks.", "医院或急诊治疗；恢复时间超过六周。")),
            new(5,T("Catastrophic", "灾难性"),T("Immediate emergency response; permanent disability or death, or hospitalisation longer than six weeks.", "需立即紧急救援；永久残疾、死亡或住院超过六周。"))
        ],
        Enumerable.Range(1,5).SelectMany(l => Enumerable.Range(1,5).Select(i => new RamCell(l,i,null))).ToArray(),
        [
            new("environment",T("Environment", "环境"),T("Terrain, location, weather and changing conditions.", "地形、场地、天气及环境变化。")),
            new("activity",T("Activity", "活动"),T("Task demands, equipment suitability, inspection and supervision.", "任务要求、设备适用性、检查及监督。")),
            new("participants",T("Participants", "参与者"),T("Human factors: skills, age, fatigue and support needs. Record arrangements, not private medical details.", "人为因素：能力、年龄、疲劳及支援需求。记录安排，勿填写私人医疗详情。")),
            new("transport",T("Transport", "交通"),T("Drivers, vehicles, route and passenger arrangements.", "驾驶员、车辆、路线及乘客安排。")),
            new("emergency",T("Emergency readiness", "应急准备"),T("First aid, communication, evacuation and response responsibilities.", "急救、通讯、撤离及应急职责。"))
        ],
        [
            Q("site","generic","environment","What hazards and changing conditions have you checked at the site?", "已核查场地哪些危害和变化条件？", "Consider access, terrain, weather and exit routes.", "考虑通行、地形、天气及离场路线。"),
            Q("task-equipment","generic","activity","How are tasks, equipment and supervision suitable for this activity?", "任务、设备和监督如何适合此活动？", "Consider task difficulty, equipment checks, competence and instructions.", "考虑任务难度、设备检查、人员能力及操作说明。"),
            Q("people","generic","participants","How will you support participants and manage human factors?", "如何支援参与者并管理人为风险？", "Consider age, experience, fatigue, boundaries and support arrangements without medical details.", "考虑年龄、经验、疲劳、界限及支援安排，勿填写医疗详情。"),
            Q("travel","generic","transport","What transport is needed and who verifies safe arrangements?", "需要哪些交通安排，由谁核查安全？", "Confirm licensed drivers, registration, roadworthiness, seatbelts and passenger lists; explain if not applicable.", "确认驾照、登记、适路性、安全带及乘客安排；不适用时说明原因。"),
            Q("response","generic","emergency","Who leads the emergency response and what resources and evacuation plan are confirmed?", "谁负责紧急应对，已确认哪些资源和撤离计划？", "Confirm qualified first aid, kit, communication, access to help and responsibilities. Do not assume availability.", "确认合资格急救人员、急救包、通讯、救援途径及职责，不可假设资源可用。"),
            Q("route","hiking","environment","Have route difficulty, turnaround points and alternative routes been checked?", "是否核查路线难度、折返点及替代路线？", "Consider group pace, daylight, navigation, terrain and weather; use verified information.", "考虑队伍速度、日照、导航、地形及天气；使用已核实资料。"),
            Q("hiking-equipment","hiking","activity","What equipment and supervision are required for this walk?", "此徒步需要哪些设备及监督？", "Check footwear, clothing, water, communications and head counts.", "检查鞋履、衣物、饮水、通讯及人数清点。"),
            Q("water-boundary","water","environment","What water conditions and safe boundaries have been confirmed?", "已确认哪些水况及安全边界？", "Review depth, currents, access, weather and a cancellation decision.", "评估水深、水流、出入、天气及取消决定。"),
            Q("water-rescue","water","emergency","Who provides competent supervision and rescue readiness?", "谁提供合资格监督及救援准备？", "Confirm skills, buoyancy equipment, rescue resources and emergency communications.", "确认能力、浮力设备、救援资源及紧急通讯。"),
            Q("sport-rules","sport","activity","How are rules, equipment and the playing area made safe?", "如何确保规则、器材及运动场地安全？", "Match intensity to ability, manage collisions, warm-up and rest.", "强度应适合能力，管理碰撞风险、热身和休息。"),
            Q("journey","transport","transport","Who verifies drivers, vehicles, route and pickup or return arrangements?", "谁核实驾驶员、车辆、路线及接送安排？", "Include fatigue, seatbelts, roadworthiness and delayed or missing passengers.", "涵盖疲劳、安全带、适路性及乘客迟到或失联。"),
            Q("overnight","camp","participants","How are overnight supervision, sleeping arrangements and safeguarding confirmed?", "如何确认过夜监督、住宿安排及保护措施？", "Include boundaries, night-time response, consent and appropriate supervision.", "涵盖界限、夜间应对、同意及适当监督。"),
            Q("camp-site","camp","environment","Have accommodation, fire exits and emergency access been checked?", "是否检查住宿、消防出口及紧急通道？", "Confirm site rules, utilities, fire procedures and bad-weather alternatives.", "确认场地规则、设施、消防程序及恶劣天气替代方案。"),
            Q("food","meal","activity","How will food hygiene, allergens and safe preparation be managed?", "如何管理食物卫生、过敏原及安全制作？", "Confirm handling, storage, utensils and support arrangements without naming medical conditions.", "确认处理、储存、用具及支援安排，勿记录具名医疗情况。"),
            Q("outdoor-weather","outdoor","environment","What weather checks and stop or shelter decisions are agreed?", "已约定哪些天气核查、停止或避险决定？", "Use confirmed forecasts and local conditions; no automatic weather assumption.", "使用已确认预报及当地情况，不可自动假设天气安全。")
        ], new(), "RAM Induction Manual Final Copy, scoring definitions (PDF p14); Event Planning, Approval and Risk Assessment SOP v2 draft §§11–15 / Module 5. Matrix colours require church administrator confirmation.");

    private static RamQuestion Q(string code,string type,string category,string en,string zh,string helpEn,string helpZh) =>
        new(code,type,category,T(en,zh),T(helpEn,helpZh));
}
