using System.Text.Json;
using System.Text.RegularExpressions;
using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Admin.EventTemplates;

public sealed record ListAdminEventActivityTemplatesQuery(
    Guid CurrentMemberId,
    string? Search,
    string? ArchetypeCode,
    string? Status,
    string? SortBy,
    string? SortDirection,
    int Page = 1,
    int PageSize = 25) : IRequest<AppResult<AdminEventActivityTemplateCatalogDto>>;

public sealed record CreateAdminEventActivityTemplateCommand(
    Guid CurrentMemberId,
    CreateAdminEventActivityTemplateRequest Request)
    : IRequest<AppResult<AdminEventActivityTemplateDto>>;

public sealed record UpdateAdminEventActivityTemplateCommand(
    Guid CurrentMemberId,
    string Code,
    string? IfMatch,
    UpdateAdminEventActivityTemplateRequest Request)
    : IRequest<AppResult<AdminEventActivityTemplateDto>>;

public sealed class ListAdminEventActivityTemplatesQueryHandler(
    IAlifeDbContext dbContext,
    IEventActivityTemplateCatalog catalog)
    : IRequestHandler<ListAdminEventActivityTemplatesQuery, AppResult<AdminEventActivityTemplateCatalogDto>>
{
    public async Task<AppResult<AdminEventActivityTemplateCatalogDto>> Handle(
        ListAdminEventActivityTemplatesQuery request,
        CancellationToken cancellationToken)
    {
        if (!await EventActivityTemplateAdminRules.CanManageAsync(
                dbContext, request.CurrentMemberId, cancellationToken))
        {
            return AppResult<AdminEventActivityTemplateCatalogDto>.Forbidden(
                "You do not have permission to manage event templates.");
        }

        var entries = await catalog.ListAsync(true, cancellationToken);
        var archetypeCode = request.ArchetypeCode?.Trim();
        if (!string.IsNullOrWhiteSpace(archetypeCode) &&
            !EventCompositionDefinitions.ArchetypesByCode.ContainsKey(archetypeCode))
        {
            return AppResult<AdminEventActivityTemplateCatalogDto>.Validation("Unknown archetypeCode.");
        }

        IEnumerable<EventActivityTemplateCatalogEntry> filtered = entries;
        if (!string.IsNullOrWhiteSpace(archetypeCode))
        {
            filtered = filtered.Where(x => x.Definition.ArchetypeCode == archetypeCode);
        }
        var status = request.Status?.Trim().ToLowerInvariant();
        filtered = status switch
        {
            null or "" or "all" => filtered,
            "active" => filtered.Where(x => x.IsActive),
            "inactive" => filtered.Where(x => !x.IsActive),
            _ => []
        };
        if (status is not null and not "" and not "all" and not "active" and not "inactive")
        {
            return AppResult<AdminEventActivityTemplateCatalogDto>.Validation("Unknown status filter.");
        }

        var search = request.Search?.Trim();
        if (!string.IsNullOrWhiteSpace(search))
        {
            filtered = filtered.Where(x =>
                x.Definition.Code.Contains(search, StringComparison.OrdinalIgnoreCase) ||
                x.Definition.Name.En.Contains(search, StringComparison.OrdinalIgnoreCase) ||
                x.Definition.Name.Zh.Contains(search, StringComparison.OrdinalIgnoreCase));
        }

        var descending = string.Equals(request.SortDirection, "desc", StringComparison.OrdinalIgnoreCase);
        filtered = (request.SortBy?.Trim().ToLowerInvariant(), descending) switch
        {
            ("code", true) => filtered.OrderByDescending(x => x.Definition.Code, StringComparer.Ordinal),
            ("code", false) => filtered.OrderBy(x => x.Definition.Code, StringComparer.Ordinal),
            ("updated", true) => filtered.OrderByDescending(x => x.UpdatedUtc),
            ("updated", false) => filtered.OrderBy(x => x.UpdatedUtc),
            ("category", true) => filtered.OrderByDescending(x => x.Definition.ArchetypeCode, StringComparer.Ordinal).ThenBy(x => x.Definition.Name.En),
            ("category", false) => filtered.OrderBy(x => x.Definition.ArchetypeCode, StringComparer.Ordinal).ThenBy(x => x.Definition.Name.En),
            (_, true) => filtered.OrderByDescending(x => x.Definition.Name.En, StringComparer.OrdinalIgnoreCase),
            _ => filtered.OrderBy(x => x.Definition.Name.En, StringComparer.OrdinalIgnoreCase)
        };

        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, 100);
        var materialized = filtered.ToArray();
        var items = materialized.Skip((page - 1) * pageSize).Take(pageSize)
            .Select(EventActivityTemplateAdminRules.ToDto)
            .ToArray();
        var totalPages = materialized.Length == 0 ? 0 : (int)Math.Ceiling(materialized.Length / (double)pageSize);
        var archetypes = EventCompositionDefinitions.Archetypes.Select(archetype => new AdminEventArchetypeDto(
            archetype.Code,
            archetype.Version,
            archetype.Name,
            false,
            entries.Count(x => x.Definition.ArchetypeCode == archetype.Code && x.IsActive),
            entries.Count(x => x.Definition.ArchetypeCode == archetype.Code))).ToArray();
        var moduleOptions = EventCompositionDefinitions.Modules
            .Where(x => x.Code is not "TEAM.WORK" and not "MONEY.FINANCE")
            .Select(x => new AdminEventTemplateModuleOptionDto(x.Code, x.Name, x.DataClasses))
            .ToArray();

        return AppResult<AdminEventActivityTemplateCatalogDto>.Success(new(
            archetypes,
            new AdminPagedResultDto<AdminEventActivityTemplateDto>(
                items, materialized.Length, page, pageSize, totalPages),
            moduleOptions,
            EventCompositionDefinitions.ActivityTypeIconKeys.OrderBy(x => x, StringComparer.Ordinal).ToArray(),
            EventCompositionDefinitions.ActivityTypeWorkflowRecommendationCodes.OrderBy(x => x, StringComparer.Ordinal).ToArray(),
            true));
    }
}

public sealed class CreateAdminEventActivityTemplateCommandHandler(
    IAlifeDbContext dbContext,
    IEventActivityTemplateCatalog catalog)
    : IRequestHandler<CreateAdminEventActivityTemplateCommand, AppResult<AdminEventActivityTemplateDto>>
{
    public async Task<AppResult<AdminEventActivityTemplateDto>> Handle(
        CreateAdminEventActivityTemplateCommand request,
        CancellationToken cancellationToken)
    {
        if (!await EventActivityTemplateAdminRules.CanManageAsync(
                dbContext, request.CurrentMemberId, cancellationToken))
        {
            return AppResult<AdminEventActivityTemplateDto>.Forbidden(
                "You do not have permission to create event templates.");
        }

        var code = EventActivityTemplateAdminRules.NormalizeCode(request.Request.Code);
        var error = EventActivityTemplateAdminRules.Validate(
            code,
            request.Request.ArchetypeCode,
            request.Request.Name,
            request.Request.Description,
            request.Request.IconKey,
            request.Request.Defaults,
            request.Request.PreselectedModules,
            request.Request.RecommendedWorkflowTemplateCode,
            request.Request.PresetServiceSlots);
        if (error is not null) return AppResult<AdminEventActivityTemplateDto>.Validation(error);
        if (await catalog.FindAsync(code, true, cancellationToken) is not null)
        {
            return AppResult<AdminEventActivityTemplateDto>.Conflict(
                "An event template with this code already exists, including inactive templates.");
        }

        var now = DateTime.UtcNow;
        var definition = EventActivityTemplateAdminRules.BuildDefinition(
            code, 1, request.Request.ArchetypeCode, request.Request.Name,
            request.Request.Description, request.Request.IconKey, request.Request.Defaults,
            request.Request.PreselectedModules, request.Request.RecommendedWorkflowTemplateCode,
            request.Request.PresetServiceSlots);
        var entity = EventActivityTemplateCatalog.CreateVersionEntity(
            definition, request.Request.IsActive, false, request.CurrentMemberId, now);
        dbContext.EventActivityTemplateVersions.Add(entity);
        dbContext.AuditLogs.Add(EventActivityTemplateAdminRules.Audit(
            request.CurrentMemberId, "event-template.create", entity, null,
            EventActivityTemplateAdminRules.ToAuditValue(definition, request.Request.IsActive)));

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            return AppResult<AdminEventActivityTemplateDto>.Conflict(
                "The event template code was created concurrently.");
        }

        return AppResult<AdminEventActivityTemplateDto>.Success(
            EventActivityTemplateAdminRules.ToDto(new(definition, entity.IsActive, false,
                EventActivityTemplateCatalog.ETag(entity), now)));
    }
}

public sealed class UpdateAdminEventActivityTemplateCommandHandler(
    IAlifeDbContext dbContext,
    IEventActivityTemplateCatalog catalog)
    : IRequestHandler<UpdateAdminEventActivityTemplateCommand, AppResult<AdminEventActivityTemplateDto>>
{
    public async Task<AppResult<AdminEventActivityTemplateDto>> Handle(
        UpdateAdminEventActivityTemplateCommand request,
        CancellationToken cancellationToken)
    {
        if (!await EventActivityTemplateAdminRules.CanManageAsync(
                dbContext, request.CurrentMemberId, cancellationToken))
        {
            return AppResult<AdminEventActivityTemplateDto>.Forbidden(
                "You do not have permission to update event templates.");
        }

        var code = EventActivityTemplateAdminRules.NormalizeCode(request.Code);
        var currentEntry = await catalog.FindAsync(code, true, cancellationToken);
        if (currentEntry is null)
        {
            return AppResult<AdminEventActivityTemplateDto>.NotFound("Event template not found.");
        }
        if (string.IsNullOrWhiteSpace(request.IfMatch) ||
            !string.Equals(request.IfMatch.Trim(), currentEntry.ETag, StringComparison.Ordinal))
        {
            return AppResult<AdminEventActivityTemplateDto>.PreconditionFailed(
                "The event template changed. Refresh before saving.");
        }

        var error = EventActivityTemplateAdminRules.Validate(
            code,
            currentEntry.Definition.ArchetypeCode,
            request.Request.Name,
            request.Request.Description,
            request.Request.IconKey,
            request.Request.Defaults,
            request.Request.PreselectedModules,
            request.Request.RecommendedWorkflowTemplateCode,
            request.Request.PresetServiceSlots);
        if (error is not null) return AppResult<AdminEventActivityTemplateDto>.Validation(error);

        var currentEntity = await dbContext.EventActivityTemplateVersions
            .FirstOrDefaultAsync(x => x.Code == code && x.IsCurrent, cancellationToken);
        if (currentEntity is null)
        {
            currentEntity = EventActivityTemplateCatalog.CreateSystemSeedEntities()
                .SingleOrDefault(x => x.Code == code);
            if (currentEntity is null)
            {
                return AppResult<AdminEventActivityTemplateDto>.Conflict(
                    "The current event template version is unavailable.");
            }
            dbContext.EventActivityTemplateVersions.Add(currentEntity);
        }

        var now = DateTime.UtcNow;
        var nextDefinition = EventActivityTemplateAdminRules.BuildDefinition(
            code,
            currentEntry.Definition.Version + 1,
            currentEntry.Definition.ArchetypeCode,
            request.Request.Name,
            request.Request.Description,
            request.Request.IconKey,
            request.Request.Defaults,
            request.Request.PreselectedModules,
            request.Request.RecommendedWorkflowTemplateCode,
            request.Request.PresetServiceSlots);
        var nextEntity = EventActivityTemplateCatalog.CreateVersionEntity(
            nextDefinition,
            request.Request.IsActive,
            currentEntry.IsSystemPreset,
            request.CurrentMemberId,
            now);
        currentEntity.IsCurrent = false;
        currentEntity.SupersededUtc = now;
        currentEntity.ConcurrencyToken = Guid.NewGuid();
        dbContext.EventActivityTemplateVersions.Add(nextEntity);
        dbContext.AuditLogs.Add(EventActivityTemplateAdminRules.Audit(
            request.CurrentMemberId,
            request.Request.IsActive == currentEntry.IsActive
                ? "event-template.update"
                : request.Request.IsActive ? "event-template.activate" : "event-template.deactivate",
            nextEntity,
            EventActivityTemplateAdminRules.ToAuditValue(currentEntry.Definition, currentEntry.IsActive),
            EventActivityTemplateAdminRules.ToAuditValue(nextDefinition, request.Request.IsActive)));

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return AppResult<AdminEventActivityTemplateDto>.PreconditionFailed(
                "The event template changed while it was being saved.");
        }
        catch (DbUpdateException)
        {
            return AppResult<AdminEventActivityTemplateDto>.Conflict(
                "The next event template version could not be created.");
        }

        return AppResult<AdminEventActivityTemplateDto>.Success(
            EventActivityTemplateAdminRules.ToDto(new(nextDefinition, nextEntity.IsActive,
                nextEntity.IsSystemPreset, EventActivityTemplateCatalog.ETag(nextEntity), now)));
    }
}

internal static partial class EventActivityTemplateAdminRules
{
    [GeneratedRegex("^[a-z][a-z0-9-]{2,79}$", RegexOptions.CultureInvariant)]
    private static partial Regex CodePattern();

    [GeneratedRegex("^[a-z][a-z0-9.]{1,79}$", RegexOptions.CultureInvariant)]
    private static partial Regex RoleCodePattern();

    public static Task<bool> CanManageAsync(
        IAlifeDbContext dbContext,
        Guid memberId,
        CancellationToken cancellationToken)
        => AdminPlatformRoleHelpers.HasPermissionAsync(
            dbContext, memberId, AdminPermissionCatalog.ManageEventTemplates, cancellationToken);

    public static string NormalizeCode(string value) => value.Trim().ToLowerInvariant();

    public static string? Validate(
        string code,
        string archetypeCode,
        LocalizedTextDto name,
        LocalizedTextDto description,
        string iconKey,
        EventActivityTypeDefaultsDto defaults,
        IReadOnlyList<string> modules,
        string? workflowCode,
        IReadOnlyList<EventActivityTypeServiceSlotPresetDto> slots)
    {
        if (!CodePattern().IsMatch(code)) return "Template code must use 3-80 lowercase letters, numbers, or hyphens and start with a letter.";
        if (!EventCompositionDefinitions.ArchetypesByCode.ContainsKey(archetypeCode)) return "Unknown archetypeCode.";
        if (string.IsNullOrWhiteSpace(name.En) || string.IsNullOrWhiteSpace(name.Zh) || name.En.Trim().Length > 200 || name.Zh.Trim().Length > 200)
            return "English and Chinese template names are required and must be at most 200 characters.";
        if (string.IsNullOrWhiteSpace(description.En) || string.IsNullOrWhiteSpace(description.Zh) || description.En.Trim().Length > 1000 || description.Zh.Trim().Length > 1000)
            return "English and Chinese descriptions are required and must be at most 1000 characters.";
        if (!EventCompositionDefinitions.ActivityTypeIconKeys.Contains(iconKey)) return "Unknown iconKey.";
        if (defaults.CapacityUnit != "People") return "capacityUnit must be People.";
        if (defaults.Visibility is not "groupVisible" and not "churchVisible" and not "public") return "Unknown visibility.";
        if (defaults.RegistrationMode is not "none" and not "required") return "Unknown registrationMode.";
        if (modules.Count != modules.Distinct(StringComparer.Ordinal).Count()) return "Preselected module codes must be unique.";
        if (modules.Any(x => !EventCompositionDefinitions.ModulesByCode.ContainsKey(x))) return "A preselected module code is unknown.";
        if (modules.Contains("TEAM.WORK")) return "TEAM.WORK is implicit and must not be stored as a template preselection.";
        if (modules.Contains("MONEY.FINANCE")) return "MONEY.FINANCE cannot be preselected by an activity template.";
        if (!string.IsNullOrWhiteSpace(workflowCode) && !EventCompositionDefinitions.ActivityTypeWorkflowRecommendationCodes.Contains(workflowCode))
            return "Unknown workflow recommendation code.";
        if (slots.Count > 50) return "A template can contain at most 50 service-slot presets.";
        if (slots.Count != slots.Select(x => x.RoleCode).Distinct(StringComparer.Ordinal).Count()) return "Service-slot role codes must be unique.";
        if (slots.Count > 0 && !modules.Contains("SERVICE.ROSTER")) return "SERVICE.ROSTER must be preselected when service-slot presets exist.";
        if (modules.Contains("SERVICE.ROSTER") && slots.Count == 0) return "At least one service-slot preset is required when SERVICE.ROSTER is preselected.";
        foreach (var slot in slots)
        {
            if (!RoleCodePattern().IsMatch(slot.RoleCode)) return $"Invalid service-slot roleCode: {slot.RoleCode}.";
            if (string.IsNullOrWhiteSpace(slot.Label.En) || string.IsNullOrWhiteSpace(slot.Label.Zh) || slot.Label.En.Trim().Length > 200 || slot.Label.Zh.Trim().Length > 200)
                return $"Bilingual labels are required for service-slot {slot.RoleCode}.";
            if (slot.RequiredCount is < 1 or > 999) return $"requiredCount must be 1-999 for service-slot {slot.RoleCode}.";
            if (slot.EligibilityCode != "approvedGroupMember") return $"Unknown eligibilityCode for service-slot {slot.RoleCode}.";
        }
        return null;
    }

    public static EventActivityTypeDefinition BuildDefinition(
        string code,
        int version,
        string archetypeCode,
        LocalizedTextDto name,
        LocalizedTextDto description,
        string iconKey,
        EventActivityTypeDefaultsDto defaults,
        IReadOnlyList<string> modules,
        string? workflowCode,
        IReadOnlyList<EventActivityTypeServiceSlotPresetDto> slots)
        => new(
            code,
            version,
            archetypeCode,
            new(name.En.Trim(), name.Zh.Trim()),
            new(description.En.Trim(), description.Zh.Trim()),
            iconKey,
            new(defaults.Visibility, defaults.RegistrationMode, "People"),
            modules.Distinct(StringComparer.Ordinal).OrderBy(x => x, StringComparer.Ordinal).ToArray(),
            string.IsNullOrWhiteSpace(workflowCode) ? null : workflowCode,
            slots.Select(x => new EventActivityTypeServiceSlotPresetDto(
                x.RoleCode.Trim(), new(x.Label.En.Trim(), x.Label.Zh.Trim()),
                x.RequiredCount, x.EligibilityCode)).ToArray());

    public static AdminEventActivityTemplateDto ToDto(EventActivityTemplateCatalogEntry entry)
        => new(entry.Definition.ToDto(), entry.IsActive, entry.IsSystemPreset, entry.ETag, entry.UpdatedUtc);

    public static object ToAuditValue(EventActivityTypeDefinition definition, bool isActive)
        => new
        {
            definition.Code,
            definition.Version,
            definition.ArchetypeCode,
            definition.Name,
            definition.IconKey,
            definition.Defaults,
            definition.PreselectedModules,
            definition.RecommendedWorkflowTemplateCode,
            definition.PresetServiceSlots,
            isActive
        };

    public static AuditLog Audit(
        Guid actorMemberId,
        string action,
        EventActivityTemplateVersion entity,
        object? before,
        object after)
        => new()
        {
            Id = Guid.NewGuid(),
            ActorMemberId = actorMemberId,
            Action = action,
            EntityType = "event_activity_template",
            EntityId = entity.Id,
            BeforeJson = before is null ? null : JsonSerializer.Serialize(before),
            AfterJson = JsonSerializer.Serialize(after),
            MetadataJson = JsonSerializer.Serialize(new { entity.Code, entity.Version, entity.ArchetypeCode }),
            OccurredUtc = entity.CreatedUtc
        };
}
