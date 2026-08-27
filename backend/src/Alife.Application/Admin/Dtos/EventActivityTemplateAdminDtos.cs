using Alife.Application.Events.Dtos;

namespace Alife.Application.Admin.Dtos;

public sealed record AdminEventArchetypeDto(
    string Code,
    int Version,
    LocalizedTextDto Name,
    bool IsMutable,
    int ActiveTemplateCount,
    int TotalTemplateCount);

public sealed record AdminEventTemplateModuleOptionDto(
    string Code,
    LocalizedTextDto Name,
    IReadOnlyList<string> DataClasses);

public sealed record AdminEventActivityTemplateDto(
    EventActivityTypeDto Template,
    bool IsActive,
    bool IsSystemPreset,
    string ETag,
    DateTime UpdatedUtc);

public sealed record AdminEventActivityTemplateCatalogDto(
    IReadOnlyList<AdminEventArchetypeDto> Archetypes,
    AdminPagedResultDto<AdminEventActivityTemplateDto> Templates,
    IReadOnlyList<AdminEventTemplateModuleOptionDto> ModuleOptions,
    IReadOnlyList<string> IconKeys,
    IReadOnlyList<string> WorkflowTemplateCodes,
    bool CanManage);

public sealed record CreateAdminEventActivityTemplateRequest(
    string Code,
    string ArchetypeCode,
    LocalizedTextDto Name,
    LocalizedTextDto Description,
    string IconKey,
    EventActivityTypeDefaultsDto Defaults,
    IReadOnlyList<string> PreselectedModules,
    string? RecommendedWorkflowTemplateCode,
    IReadOnlyList<EventActivityTypeServiceSlotPresetDto> PresetServiceSlots,
    bool IsActive = true);

public sealed record UpdateAdminEventActivityTemplateRequest(
    LocalizedTextDto Name,
    LocalizedTextDto Description,
    string IconKey,
    EventActivityTypeDefaultsDto Defaults,
    IReadOnlyList<string> PreselectedModules,
    string? RecommendedWorkflowTemplateCode,
    IReadOnlyList<EventActivityTypeServiceSlotPresetDto> PresetServiceSlots,
    bool IsActive);
