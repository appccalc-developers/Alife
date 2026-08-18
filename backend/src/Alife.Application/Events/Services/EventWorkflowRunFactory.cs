using Alife.Application.Events.Dtos;
using Alife.Domain.Entities;
using Alife.Domain.Enums;

namespace Alife.Application.Events.Services;

public static class EventWorkflowRunFactory
{
    public static EventWorkflowRun Create(
        GroupEvent groupEvent,
        EventWorkflowTemplate template,
        IReadOnlyList<EventWorkflowStageDefinitionDto> stages,
        Guid currentMemberId,
        DateTime now)
    {
        var run = new EventWorkflowRun
        {
            Id = Guid.NewGuid(),
            EventId = groupEvent.Id,
            TemplateId = template.Id,
            TemplateVersion = template.Version,
            TemplateSnapshotJson = template.DefinitionJson,
            Status = EventWorkflowRunStatus.Active,
            StartedUtc = now,
            UpdatedUtc = now,
            Template = template
        };

        for (var index = 0; index < stages.Count; index++)
        {
            var definition = stages[index];
            var stepStatus = InitialStepStatus(definition, groupEvent.RamAssessment);
            var step = new EventWorkflowStep
            {
                Id = Guid.NewGuid(),
                WorkflowRunId = run.Id,
                StepKey = definition.Key,
                SortOrder = index + 1,
                NameEn = definition.Name.En,
                NameZh = definition.Name.Zh,
                IsRequired = definition.Required,
                RequiresApproval = definition.RequiresApproval,
                IntegrationKey = definition.IntegrationKey,
                Status = stepStatus,
                CompletedByMemberId = stepStatus == EventWorkflowStepStatus.Completed
                    ? groupEvent.RamAssessment?.ApprovedByMemberId
                    : null,
                CompletedUtc = stepStatus == EventWorkflowStepStatus.Completed
                    ? groupEvent.RamAssessment?.ApprovedUtc
                    : null,
                CreatedUtc = now,
                UpdatedUtc = now
            };

            foreach (var artifactDefinition in definition.Artifacts)
            {
                var isRam = definition.IntegrationKey == "ram" && artifactDefinition.Type == "ram";
                var artifactStatus = isRam
                    ? InitialRamArtifactStatus(groupEvent.RamAssessment)
                    : EventArtifactStatus.Draft;
                step.Artifacts.Add(new EventArtifact
                {
                    Id = Guid.NewGuid(),
                    EventId = groupEvent.Id,
                    WorkflowStepId = step.Id,
                    ArtifactType = artifactDefinition.Type,
                    TitleEn = artifactDefinition.Title.En,
                    TitleZh = artifactDefinition.Title.Zh,
                    IsRequired = artifactDefinition.Required,
                    Status = artifactStatus,
                    Visibility = artifactDefinition.Visibility,
                    DataJson = isRam ? groupEvent.RamAssessment?.RamDataJson ?? "{}" : "{}",
                    CreatedByMemberId = currentMemberId,
                    ApprovedByMemberId = artifactStatus == EventArtifactStatus.Approved
                        ? groupEvent.RamAssessment?.ApprovedByMemberId
                        : null,
                    ApprovedUtc = artifactStatus == EventArtifactStatus.Approved
                        ? groupEvent.RamAssessment?.ApprovedUtc
                        : null,
                    CreatedUtc = now,
                    UpdatedUtc = now
                });
            }

            run.Steps.Add(step);
        }

        EventWorkflowDefinition.RecalculateRun(run, now);
        return run;
    }

    private static EventWorkflowStepStatus InitialStepStatus(
        EventWorkflowStageDefinitionDto definition,
        EventRamAssessment? ram)
    {
        if (definition.IntegrationKey != "ram" || ram is null)
        {
            return EventWorkflowStepStatus.NotStarted;
        }

        return ram.Status switch
        {
            EventRamStatus.Approved => EventWorkflowStepStatus.Completed,
            EventRamStatus.AwaitingReview => EventWorkflowStepStatus.AwaitingApproval,
            _ when ram.RamDataJson != "{}" => EventWorkflowStepStatus.InProgress,
            _ => EventWorkflowStepStatus.NotStarted
        };
    }

    private static EventArtifactStatus InitialRamArtifactStatus(EventRamAssessment? ram) => ram?.Status switch
    {
        EventRamStatus.Approved => EventArtifactStatus.Approved,
        EventRamStatus.AwaitingReview => EventArtifactStatus.Submitted,
        _ => EventArtifactStatus.Draft
    };
}
