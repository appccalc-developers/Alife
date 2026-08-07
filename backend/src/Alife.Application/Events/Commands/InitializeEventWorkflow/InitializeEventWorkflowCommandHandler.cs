using System.Text.Json;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Commands.InitializeEventWorkflow;

public sealed class InitializeEventWorkflowCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService)
    : IRequestHandler<InitializeEventWorkflowCommand, AppResult<EventWorkflowDto>>
{
    public async Task<AppResult<EventWorkflowDto>> Handle(
        InitializeEventWorkflowCommand request,
        CancellationToken cancellationToken)
    {
        var groupEvent = await dbContext.GroupEvents
            .Include(x => x.RamAssessment)
            .FirstOrDefaultAsync(x => x.Id == request.EventId, cancellationToken);
        if (groupEvent is null)
        {
            return AppResult<EventWorkflowDto>.NotFound("Event not found.");
        }
        if (!await groupAuthorizationService.IsLeaderOrCoLeaderAsync(groupEvent.GroupId, request.CurrentMemberId, cancellationToken))
        {
            return AppResult<EventWorkflowDto>.Forbidden("Only group leaders and co-leaders can initialize an event workflow.");
        }
        if (await dbContext.EventWorkflowRuns.AnyAsync(x => x.EventId == request.EventId, cancellationToken))
        {
            return AppResult<EventWorkflowDto>.Conflict("This event already has a workflow.");
        }

        var code = request.TemplateCode.Trim().ToLowerInvariant();
        var template = await dbContext.EventWorkflowTemplates
            .Where(x => x.IsActive && x.Code == code)
            .OrderByDescending(x => x.Version)
            .FirstOrDefaultAsync(cancellationToken);
        if (template is null)
        {
            return AppResult<EventWorkflowDto>.NotFound("Workflow template not found.");
        }

        IReadOnlyList<EventWorkflowStageDefinitionDto> stages;
        try
        {
            stages = EventWorkflowDefinition.Parse(template.DefinitionJson);
        }
        catch (JsonException)
        {
            return AppResult<EventWorkflowDto>.Validation("The selected workflow template is invalid.");
        }

        var now = DateTime.UtcNow;
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
                var artifactStatus = isRam ? InitialRamArtifactStatus(groupEvent.RamAssessment) : EventArtifactStatus.Draft;
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
                    CreatedByMemberId = request.CurrentMemberId,
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
        dbContext.EventWorkflowRuns.Add(run);
        await dbContext.SaveChangesAsync(cancellationToken);
        return AppResult<EventWorkflowDto>.Success(EventWorkflowDefinition.ToDto(run));
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
