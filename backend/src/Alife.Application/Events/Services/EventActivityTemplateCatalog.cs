using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Alife.Application.Common.Interfaces;
using Alife.Application.Events.Dtos;
using Alife.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Services;

public sealed record EventActivityTemplateCatalogEntry(
    EventActivityTypeDefinition Definition,
    bool IsActive,
    bool IsSystemPreset,
    string ETag,
    DateTime UpdatedUtc);

public interface IEventActivityTemplateCatalog
{
    Task<IReadOnlyList<EventActivityTemplateCatalogEntry>> ListAsync(
        bool includeInactive,
        CancellationToken cancellationToken);

    Task<IReadOnlyDictionary<string, EventActivityTypeDefinition>> ActiveDefinitionsByCodeAsync(
        CancellationToken cancellationToken);

    Task<EventActivityTemplateCatalogEntry?> FindAsync(
        string code,
        bool includeInactive,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<EventArchetypeDto>> ListActiveArchetypesAsync(
        CancellationToken cancellationToken);
}

public sealed class EventActivityTemplateCatalog(IAlifeDbContext dbContext) : IEventActivityTemplateCatalog
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private static readonly DateTime SystemSeedCreatedUtc = new(2026, 8, 27, 0, 0, 0, DateTimeKind.Utc);

    public async Task<IReadOnlyList<EventActivityTemplateCatalogEntry>> ListAsync(
        bool includeInactive,
        CancellationToken cancellationToken)
    {
        var rows = await dbContext.EventActivityTemplateVersions.AsNoTracking()
            .Where(x => x.IsCurrent)
            .ToListAsync(cancellationToken);
        var byCode = rows.ToDictionary(x => x.Code, StringComparer.Ordinal);
        var result = new List<EventActivityTemplateCatalogEntry>();

        foreach (var shipped in EventCompositionDefinitions.ActivityTypes)
        {
            if (byCode.Remove(shipped.Code, out var persisted))
            {
                if (includeInactive || persisted.IsActive) result.Add(ToEntry(persisted));
            }
            else result.Add(ToFallbackEntry(shipped));
        }

        foreach (var persisted in byCode.Values)
        {
            if (includeInactive || persisted.IsActive) result.Add(ToEntry(persisted));
        }

        return result
            .OrderBy(x => x.Definition.ArchetypeCode, StringComparer.Ordinal)
            .ThenBy(x => x.Definition.Name.En, StringComparer.OrdinalIgnoreCase)
            .ThenBy(x => x.Definition.Code, StringComparer.Ordinal)
            .ToArray();
    }

    public async Task<IReadOnlyDictionary<string, EventActivityTypeDefinition>> ActiveDefinitionsByCodeAsync(
        CancellationToken cancellationToken)
        => (await ListAsync(false, cancellationToken))
            .ToDictionary(x => x.Definition.Code, x => x.Definition, StringComparer.Ordinal);

    public async Task<EventActivityTemplateCatalogEntry?> FindAsync(
        string code,
        bool includeInactive,
        CancellationToken cancellationToken)
        => (await ListAsync(includeInactive, cancellationToken))
            .FirstOrDefault(x => string.Equals(x.Definition.Code, code, StringComparison.Ordinal));

    public async Task<IReadOnlyList<EventArchetypeDto>> ListActiveArchetypesAsync(
        CancellationToken cancellationToken)
        => EventCompositionDefinitions.BuildArchetypes(
            (await ListAsync(false, cancellationToken)).Select(x => x.Definition));

    public static EventActivityTemplateVersion[] CreateSystemSeedEntities()
        => EventCompositionDefinitions.ActivityTypes
            .Select(definition => CreateVersionEntity(
                definition,
                isActive: true,
                isSystemPreset: true,
                createdByMemberId: null,
                createdUtc: SystemSeedCreatedUtc,
                id: DeterministicGuid($"event-activity-template:{definition.Code}:v{definition.Version}"),
                concurrencyToken: DeterministicGuid($"event-activity-template:{definition.Code}:v{definition.Version}:etag")))
            .ToArray();

    public static EventActivityTemplateVersion CreateVersionEntity(
        EventActivityTypeDefinition definition,
        bool isActive,
        bool isSystemPreset,
        Guid? createdByMemberId,
        DateTime createdUtc,
        Guid? id = null,
        Guid? concurrencyToken = null)
        => new()
        {
            Id = id ?? Guid.NewGuid(),
            Code = definition.Code,
            Version = definition.Version,
            ArchetypeCode = definition.ArchetypeCode,
            NameEn = definition.Name.En,
            NameZh = definition.Name.Zh,
            DescriptionEn = definition.Description.En,
            DescriptionZh = definition.Description.Zh,
            IconKey = definition.IconKey,
            Visibility = definition.Defaults.Visibility,
            RegistrationMode = definition.Defaults.RegistrationMode,
            PreselectedModulesJson = JsonSerializer.Serialize(definition.PreselectedModules, JsonOptions),
            RecommendedWorkflowTemplateCode = definition.RecommendedWorkflowTemplateCode,
            PresetServiceSlotsJson = JsonSerializer.Serialize(definition.PresetServiceSlots, JsonOptions),
            IsActive = isActive,
            IsCurrent = true,
            IsSystemPreset = isSystemPreset,
            CreatedByMemberId = createdByMemberId,
            CreatedUtc = createdUtc,
            ConcurrencyToken = concurrencyToken ?? Guid.NewGuid()
        };

    public static EventActivityTypeDefinition ToDefinition(EventActivityTemplateVersion row)
        => new(
            row.Code,
            row.Version,
            row.ArchetypeCode,
            new LocalizedTextDto(row.NameEn, row.NameZh),
            new LocalizedTextDto(row.DescriptionEn, row.DescriptionZh),
            row.IconKey,
            new EventActivityTypeDefaultsDto(row.Visibility, row.RegistrationMode, "People"),
            JsonSerializer.Deserialize<string[]>(row.PreselectedModulesJson, JsonOptions) ?? [],
            row.RecommendedWorkflowTemplateCode,
            JsonSerializer.Deserialize<EventActivityTypeServiceSlotPresetDto[]>(row.PresetServiceSlotsJson, JsonOptions) ?? []);

    public static string ETag(EventActivityTemplateVersion row)
        => $"\"event-template-{row.Code}-v{row.Version}-{row.ConcurrencyToken:N}\"";

    private static EventActivityTemplateCatalogEntry ToEntry(EventActivityTemplateVersion row)
        => new(ToDefinition(row), row.IsActive, row.IsSystemPreset, ETag(row), row.CreatedUtc);

    private static EventActivityTemplateCatalogEntry ToFallbackEntry(EventActivityTypeDefinition definition)
    {
        var token = DeterministicGuid($"event-activity-template:{definition.Code}:v{definition.Version}:etag");
        return new(
            definition,
            true,
            true,
            $"\"event-template-{definition.Code}-v{definition.Version}-{token:N}\"",
            SystemSeedCreatedUtc);
    }

    private static Guid DeterministicGuid(string value)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(value));
        return new Guid(bytes[..16]);
    }
}
