using Alife.Domain.Enums;

namespace Alife.Application.Events.Dtos;

public sealed record WorkflowTextDto(string En, string Zh);

public sealed record EventArtifactRequirementDto(
    string Type,
    WorkflowTextDto Title,
    bool Required,
    FileAssetVisibility Visibility);

public sealed record EventWorkflowStageDefinitionDto(
    string Key,
    WorkflowTextDto Name,
    bool Required,
    bool RequiresApproval,
    string? IntegrationKey,
    IReadOnlyList<EventArtifactRequirementDto> Artifacts);

public sealed record EventWorkflowTemplateDto(
    Guid Id,
    Guid? OwnerGroupId,
    string Code,
    int Version,
    WorkflowTextDto Name,
    WorkflowTextDto Description,
    IReadOnlyList<EventWorkflowStageDefinitionDto> Stages);

public sealed record EventArtifactDto(
    Guid Id,
    Guid EventId,
    Guid? WorkflowStepId,
    string ArtifactType,
    WorkflowTextDto Title,
    bool IsRequired,
    EventArtifactStatus Status,
    FileAssetVisibility Visibility,
    Guid? FileAssetId,
    string DataJson,
    Guid CreatedByMemberId,
    Guid? ApprovedByMemberId,
    DateTime? ApprovedUtc,
    DateTime CreatedUtc,
    DateTime UpdatedUtc);

public sealed record EventWorkflowStepDto(
    Guid Id,
    string StepKey,
    int SortOrder,
    WorkflowTextDto Name,
    bool IsRequired,
    bool RequiresApproval,
    string? IntegrationKey,
    EventWorkflowStepStatus Status,
    Guid? AssignedMemberId,
    DateTime? DueUtc,
    Guid? CompletedByMemberId,
    DateTime? CompletedUtc,
    IReadOnlyList<EventArtifactDto> Artifacts);

public sealed record EventWorkflowDto(
    Guid Id,
    Guid EventId,
    EventWorkflowRunStatus Status,
    string? CurrentStepKey,
    DateTime StartedUtc,
    DateTime? CompletedUtc,
    DateTime UpdatedUtc,
    EventWorkflowTemplateDto Template,
    IReadOnlyList<EventWorkflowStepDto> Steps);
