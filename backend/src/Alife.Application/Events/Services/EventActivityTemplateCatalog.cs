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
    private sealed record PresetProjectsPayload(
        int QuestionnaireVersion,
        string CompositionSchemaVersion,
        IReadOnlyList<EventTemplatePresetProjectDto> Projects);

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
                if (HasCurrentComposition(persisted.PresetProjectsJson))
                {
                    if (includeInactive || persisted.IsActive) result.Add(ToEntry(persisted));
                }
                else if (includeInactive)
                {
                    result.Add(ToEntry(persisted) with { IsActive = false });
                }
            }
            else result.Add(ToFallbackEntry(shipped));
        }

        foreach (var persisted in byCode.Values)
        {
            if (HasCurrentComposition(persisted.PresetProjectsJson))
            {
                if (includeInactive || persisted.IsActive) result.Add(ToEntry(persisted));
            }
            else if (includeInactive)
            {
                result.Add(ToEntry(persisted) with { IsActive = false });
            }
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

    // EF seed rows are the immutable original v2 definitions. New defaults are explicit successor versions.
    public static EventActivityTemplateVersion[] CreateSystemSeedEntities()
        => EventCompositionDefinitions.ActivityTypes.Select(current =>
        {
            var original = current with { Version = 2, PresetProjects = [] };
            var row = CreateVersionEntity(original, true, true, null, SystemSeedCreatedUtc,
                id: DeterministicGuid($"event-activity-template:{original.Code}:v2"),
                concurrencyToken: DeterministicGuid($"event-activity-template:{original.Code}:v2:etag"));
            row.PresetProjectsJson = null;
            return row;
        }).ToArray();

    public static EventActivityTemplateVersion CreateVersionEntity(
        EventActivityTypeDefinition definition,
        bool isActive,
        bool isSystemPreset,
        Guid? createdByMemberId,
        DateTime createdUtc,
        Guid? id = null,
        Guid? concurrencyToken = null,
        string? compositionSchemaVersion = EventCompositionDefinitions.SchemaVersion)
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
            PresetProjectsJson = compositionSchemaVersion is not null
                ? JsonSerializer.Serialize(new PresetProjectsPayload(2, compositionSchemaVersion, definition.PresetProjects), JsonOptions)
                : JsonSerializer.Serialize(definition.PresetProjects, JsonOptions),
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
            JsonSerializer.Deserialize<EventActivityTypeServiceSlotPresetDto[]>(row.PresetServiceSlotsJson, JsonOptions) ?? [],
            ReadPresetProjects(row.PresetProjectsJson));

    // Explicit local initialization, never a side effect of reading the catalogue.
    // NULL is pre-feature data; an explicitly saved [] remains empty on subsequent runs.
    public static async Task<int> InitializePresetProjectVersionsAsync(IAlifeDbContext db, CancellationToken ct, Guid? actor = null)
    {
        await using var transaction = await db.BeginSerializableTransactionAsync(ct);
        var rows = await db.EventActivityTemplateVersions.Where(r => r.IsCurrent && r.PresetProjectsJson == null).ToListAsync(ct);
        if (rows.Count == 0) return 0;
        var codes = rows.Select(r => r.Code).ToArray();
        var maximumVersions = await db.EventActivityTemplateVersions.Where(r => codes.Contains(r.Code))
            .GroupBy(r => r.Code).Select(g => new { Code = g.Key, Version = g.Max(r => r.Version) }).ToDictionaryAsync(r => r.Code, r => r.Version, ct);
        var now = DateTime.UtcNow;
        var nextRows = new List<EventActivityTemplateVersion>();
        var audits = new List<AuditLog>();
        foreach (var row in rows)
        {
            var previous = ToDefinition(row);
            var nextDefinition = previous with
            {
                Version = maximumVersions[row.Code] + 1,
                PresetProjects = EventTemplateProjectDefaults.ForTemplate(row.Code, row.ArchetypeCode == "recurring-gathering")
            };
            var next = CreateVersionEntity(nextDefinition, row.IsActive, row.IsSystemPreset, actor, now,
                id: DeterministicGuid($"event-activity-template:{row.Code}:v{nextDefinition.Version}"),
                compositionSchemaVersion: null);
            nextRows.Add(next);
            row.IsCurrent = false; row.SupersededUtc = now; row.ConcurrencyToken = Guid.NewGuid();
            audits.Add(new()
            {
                Id = Guid.NewGuid(), ActorMemberId = actor, Action = "event-template.initialize-projects", EntityType = "event_activity_template", EntityId = next.Id,
                BeforeJson = JsonSerializer.Serialize(previous, JsonOptions), AfterJson = JsonSerializer.Serialize(nextDefinition, JsonOptions),
                MetadataJson = JsonSerializer.Serialize(new { row.Code, previousVersion = row.Version, version = next.Version }, JsonOptions), OccurredUtc = now
            });
        }
        // Release the filtered current-code index before inserting successor versions.
        await db.SaveChangesAsync(ct);
        foreach (var next in nextRows) db.EventActivityTemplateVersions.Add(next);
        foreach (var audit in audits) db.AuditLogs.Add(audit);
        await db.SaveChangesAsync(ct);
        if (transaction is not null) await transaction.CommitAsync(ct);
        return nextRows.Count;
    }

    // Explicit Event 2.0 successor. Copy every administrator-edited current template once;
    // never mutate archived versions or an existing Event plan.
    public static async Task<int> InitializeQuestionnaireVersionsAsync(
        IAlifeDbContext db, CancellationToken ct, Guid? actor = null, bool apply = true)
    {
        await using var transaction = await db.BeginSerializableTransactionAsync(ct);
        var shippedCodes = EventCompositionDefinitions.ActivityTypes.Select(t => t.Code).ToArray();
        var rows = (await db.EventActivityTemplateVersions
            .Where(r => r.IsCurrent && r.Version >= 3 && shippedCodes.Contains(r.Code))
            .ToListAsync(ct))
            .Where(r => !HasCurrentComposition(r.PresetProjectsJson))
            .ToArray();
        if (rows.Length == 0) return 0;
        if (!apply) return rows.Length;
        var now = DateTime.UtcNow;
        var maximumVersions = await db.EventActivityTemplateVersions.Where(r => shippedCodes.Contains(r.Code))
            .GroupBy(r => r.Code)
            .Select(g => new { Code = g.Key, Version = g.Max(r => r.Version) })
            .ToDictionaryAsync(r => r.Code, r => r.Version, ct);
        var nextRows = new List<EventActivityTemplateVersion>();
        var audits = new List<AuditLog>();
        foreach (var row in rows)
        {
            var previous = ToDefinition(row);
            var projects = HasQuestionnaireV2(row.PresetProjectsJson)
                ? previous.PresetProjects
                : previous.PresetProjects.Select(project => project with
                {
                    DefaultAnswers = EventProjectQuestionCatalog.Definitions.ToDictionary(
                        question => question.Code,
                        question => project.DefaultAnswers.TryGetValue(question.Code, out var value) && value == "yes"
                            ? "yes"
                            : EventProjectQuestionCatalog.GeneralSwitchCodes.Contains(question.Code)
                                ? "no"
                                : project.DefaultAnswers.TryGetValue(question.Code, out value) ? value : "unknown",
                        StringComparer.Ordinal),
                    EventFactSuggestions = EventProjectQuestionCatalog.MovedEventFactCodes
                        .Where(moved => project.DefaultAnswers.TryGetValue(moved.Key, out var answer) && answer == "yes")
                        .Select(moved => moved.Value).Order(StringComparer.Ordinal).ToArray()
                }).ToArray();
            var successor = previous with
            {
                Version = maximumVersions[row.Code] + 1,
                PresetProjects = projects
            };
            var next = CreateVersionEntity(successor, row.IsActive, row.IsSystemPreset, actor, now,
                id: DeterministicGuid($"event-activity-template:{row.Code}:v{successor.Version}"));
            nextRows.Add(next);
            row.IsCurrent = false;
            row.SupersededUtc = now;
            row.ConcurrencyToken = Guid.NewGuid();
            audits.Add(new AuditLog
            {
                Id = Guid.NewGuid(), ActorMemberId = actor, Action = "event-template.initialize-event2",
                EntityType = "event_activity_template", EntityId = next.Id,
                BeforeJson = JsonSerializer.Serialize(previous, JsonOptions),
                AfterJson = JsonSerializer.Serialize(successor, JsonOptions),
                MetadataJson = JsonSerializer.Serialize(new
                {
                    row.Code,
                    previousVersion = row.Version,
                    version = next.Version,
                    compositionSchemaVersion = EventCompositionDefinitions.SchemaVersion
                }, JsonOptions),
                OccurredUtc = now
            });
        }
        await db.SaveChangesAsync(ct);
        foreach (var next in nextRows) db.EventActivityTemplateVersions.Add(next);
        foreach (var audit in audits) db.AuditLogs.Add(audit);
        await db.SaveChangesAsync(ct);
        if (transaction is not null) await transaction.CommitAsync(ct);
        return nextRows.Count;
    }

    private static EventTemplatePresetProjectDto[] ReadPresetProjects(string? json)
    {
        if (json is null) return [];
        using var document = JsonDocument.Parse(json);
        if (document.RootElement.ValueKind == JsonValueKind.Array)
            return JsonSerializer.Deserialize<EventTemplatePresetProjectDto[]>(json, JsonOptions) ?? [];
        if (document.RootElement.ValueKind == JsonValueKind.Object &&
            document.RootElement.TryGetProperty("questionnaireVersion", out var version) &&
            version.ValueKind == JsonValueKind.Number && version.GetInt32() == 2 &&
            document.RootElement.TryGetProperty("projects", out var projects) &&
            projects.ValueKind == JsonValueKind.Array)
            return JsonSerializer.Deserialize<EventTemplatePresetProjectDto[]>(projects.GetRawText(), JsonOptions) ?? [];
        throw new JsonException("Invalid template preset-project payload.");
    }

    private static bool HasQuestionnaireV2(string? json)
    {
        if (json is null) return false;
        using var document = JsonDocument.Parse(json);
        return document.RootElement.ValueKind == JsonValueKind.Object &&
            document.RootElement.TryGetProperty("questionnaireVersion", out var version) &&
            version.ValueKind == JsonValueKind.Number && version.GetInt32() == 2 &&
            document.RootElement.TryGetProperty("projects", out var projects) &&
            projects.ValueKind == JsonValueKind.Array;
    }

    private static bool HasCurrentComposition(string? json)
    {
        if (json is null) return false;
        using var document = JsonDocument.Parse(json);
        return document.RootElement.ValueKind == JsonValueKind.Object &&
            document.RootElement.TryGetProperty("questionnaireVersion", out var questionnaireVersion) &&
            questionnaireVersion.ValueKind == JsonValueKind.Number && questionnaireVersion.GetInt32() == 2 &&
            document.RootElement.TryGetProperty("compositionSchemaVersion", out var compositionVersion) &&
            compositionVersion.ValueKind == JsonValueKind.String &&
            EventCompositionDefinitions.IsSupportedSchema(compositionVersion.GetString()) &&
            document.RootElement.TryGetProperty("projects", out var projects) &&
            projects.ValueKind == JsonValueKind.Array;
    }

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
