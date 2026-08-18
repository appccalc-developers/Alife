using System.Text.Json;
using Alife.Application.Events.Dtos;
using Alife.Domain.Entities;
using Alife.Domain.Enums;

namespace Alife.Application.Events.Services;

public static class EventWorkflowDefinition
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public static IReadOnlyList<EventWorkflowStageDefinitionDto> Parse(string definitionJson)
    {
        var definition = JsonSerializer.Deserialize<DefinitionDocument>(definitionJson, JsonOptions)
            ?? throw new JsonException("Workflow definition is missing.");
        if (definition.Stages.Count == 0)
        {
            throw new JsonException("Workflow definition must contain at least one stage.");
        }

        var keys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var stages = new List<EventWorkflowStageDefinitionDto>(definition.Stages.Count);
        foreach (var stage in definition.Stages)
        {
            var key = NormalizeCode(stage.Key);
            if (string.IsNullOrWhiteSpace(key) || !keys.Add(key))
            {
                throw new JsonException("Workflow stage keys must be non-empty and unique.");
            }

            var artifacts = stage.Artifacts.Select(artifact => new EventArtifactRequirementDto(
                NormalizeCode(artifact.Type),
                new WorkflowTextDto(artifact.Title.En.Trim(), artifact.Title.Zh.Trim()),
                artifact.Required,
                ParseVisibility(artifact.Visibility))).ToArray();
            if (artifacts.Any(x => string.IsNullOrWhiteSpace(x.Type)))
            {
                throw new JsonException("Artifact types must be non-empty.");
            }

            stages.Add(new EventWorkflowStageDefinitionDto(
                key,
                new WorkflowTextDto(stage.Name.En.Trim(), stage.Name.Zh.Trim()),
                stage.Required,
                stage.RequiresApproval,
                string.IsNullOrWhiteSpace(stage.IntegrationKey) ? null : NormalizeCode(stage.IntegrationKey),
                artifacts));
        }

        return stages;
    }

    public static EventWorkflowTemplateDto ToDto(EventWorkflowTemplate template) => new(
        template.Id,
        template.OwnerGroupId,
        template.Code,
        template.Version,
        new WorkflowTextDto(template.NameEn, template.NameZh),
        new WorkflowTextDto(template.DescriptionEn, template.DescriptionZh),
        Parse(template.DefinitionJson));

    public static EventWorkflowDto ToDto(EventWorkflowRun run, bool includePrivateArtifacts = true)
    {
        var template = new EventWorkflowTemplateDto(
            run.Template.Id,
            run.Template.OwnerGroupId,
            run.Template.Code,
            run.TemplateVersion,
            new WorkflowTextDto(run.Template.NameEn, run.Template.NameZh),
            new WorkflowTextDto(run.Template.DescriptionEn, run.Template.DescriptionZh),
            Parse(run.TemplateSnapshotJson));
        var steps = run.Steps
            .OrderBy(x => x.SortOrder)
            .Select(step => new EventWorkflowStepDto(
                step.Id,
                step.StepKey,
                step.SortOrder,
                new WorkflowTextDto(step.NameEn, step.NameZh),
                step.IsRequired,
                step.RequiresApproval,
                step.IntegrationKey,
                step.Status,
                step.AssignedMemberId,
                step.DueUtc,
                step.CompletedByMemberId,
                step.CompletedUtc,
                step.Artifacts
                    .Where(x => includePrivateArtifacts || x.Visibility != FileAssetVisibility.MemberPrivate)
                    .OrderBy(x => x.CreatedUtc)
                    .Select(ToDto)
                    .ToArray()))
            .ToArray();
        return new EventWorkflowDto(
            run.Id,
            run.EventId,
            run.Status,
            run.CurrentStepKey,
            run.StartedUtc,
            run.CompletedUtc,
            run.UpdatedUtc,
            template,
            steps);
    }

    public static EventArtifactDto ToDto(EventArtifact artifact) => new(
        artifact.Id,
        artifact.EventId,
        artifact.WorkflowStepId,
        artifact.ArtifactType,
        new WorkflowTextDto(artifact.TitleEn, artifact.TitleZh),
        artifact.IsRequired,
        artifact.Status,
        artifact.Visibility,
        artifact.FileAssetId,
        artifact.DataJson,
        artifact.CreatedByMemberId,
        artifact.ApprovedByMemberId,
        artifact.ApprovedUtc,
        artifact.CreatedUtc,
        artifact.UpdatedUtc);

    public static void RecalculateRun(EventWorkflowRun run, DateTime now)
    {
        var ordered = run.Steps.OrderBy(x => x.SortOrder).ToArray();
        var complete = ordered.All(x => !x.IsRequired || x.Status == EventWorkflowStepStatus.Completed);
        run.Status = complete ? EventWorkflowRunStatus.Completed : EventWorkflowRunStatus.Active;
        run.CompletedUtc = complete ? now : null;
        run.CurrentStepKey = complete
            ? null
            : ordered.FirstOrDefault(x => x.Status is not EventWorkflowStepStatus.Completed and not EventWorkflowStepStatus.Skipped)?.StepKey;
        run.UpdatedUtc = now;
    }

    private static string NormalizeCode(string? value)
        => value?.Trim().ToLowerInvariant().Replace('-', '_').Replace(' ', '_') ?? string.Empty;

    private static FileAssetVisibility ParseVisibility(string value) => value.Trim().ToLowerInvariant() switch
    {
        "public" => FileAssetVisibility.Public,
        "memberprivate" or "member_private" => FileAssetVisibility.MemberPrivate,
        _ => FileAssetVisibility.GroupVisible
    };

    private sealed record DefinitionDocument(List<StageDocument> Stages)
    {
        public DefinitionDocument() : this([]) { }
    }

    private sealed record StageDocument(
        string Key,
        TextDocument Name,
        bool Required,
        bool RequiresApproval,
        string? IntegrationKey,
        List<ArtifactDocument> Artifacts)
    {
        public StageDocument() : this(string.Empty, new(), false, false, null, []) { }
    }

    private sealed record ArtifactDocument(
        string Type,
        TextDocument Title,
        bool Required,
        string Visibility)
    {
        public ArtifactDocument() : this(string.Empty, new(), false, "groupVisible") { }
    }

    private sealed record TextDocument(string En, string Zh)
    {
        public TextDocument() : this(string.Empty, string.Empty) { }
    }
}
