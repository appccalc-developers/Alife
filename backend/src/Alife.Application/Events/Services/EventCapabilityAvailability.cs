using Alife.Application.Events.Dtos;

namespace Alife.Application.Events.Services;

public sealed record EventCapabilityAvailabilityDto(string ModuleCode, string Status, LocalizedTextDto Description);

// Live delivery information is deliberately outside immutable Plan/module versions.
public static class EventCapabilityAvailability
{
    public static IReadOnlyList<EventCapabilityAvailabilityDto> All => EventCompositionDefinitions.Modules.Select(module => module.Code switch
    {
        "MONEY.FINANCE" => new EventCapabilityAvailabilityDto(module.Code, "unavailable", new("Budget, fees, claims and reconciliation tools are not available yet.", "预算、收费、报销和对账工具尚未提供。")),
        "FOOD.HOSPITALITY" => new(module.Code, "unavailable", new("Menu, dietary needs and food-service tools are not available yet.", "菜单、饮食需求及餐饮筹备工具尚未提供。")),
        "FESTIVAL.OPERATIONS" => new(module.Code, "unavailable", new("Zone operations, command and incident tools are not available yet.", "分区运营、现场指挥和事件处理工具尚未提供。")),
        "COMMS.FOLLOWUP" => new(module.Code, "partial", new("Event content, posters and publication are available. Audience-confirmed broadcasts, delivery tracking and follow-up are not yet provided.", "已有活动文案、海报和发布功能；收件人确认、广播发送、投递追踪及跟进流程尚未提供。")),
        _ => new(module.Code, "coreAvailable", new("Core tools are available; readiness is checked separately.", "已有核心工具；是否准备完成仍需另行检查。"))
    }).ToArray();
}
