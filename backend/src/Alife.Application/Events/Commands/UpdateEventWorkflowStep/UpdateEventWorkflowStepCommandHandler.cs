using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Commands.UpdateEventWorkflowStep;

public sealed class UpdateEventWorkflowStepCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService)
    : IRequestHandler<UpdateEventWorkflowStepCommand, AppResult<EventWorkflowDto>>
{
    public async Task<AppResult<EventWorkflowDto>> Handle(UpdateEventWorkflowStepCommand request, CancellationToken cancellationToken)
    {
        var run = await dbContext.EventWorkflowRuns
            .Include(x => x.Event)
            .Include(x => x.Template)
            .Include(x => x.Steps)
                .ThenInclude(x => x.Artifacts)
            .FirstOrDefaultAsync(x => x.EventId == request.EventId, cancellationToken);
        if (run is null)
        {
            return AppResult<EventWorkflowDto>.NotFound("Event workflow not found.");
        }
        if (!await groupAuthorizationService.IsLeaderOrCoLeaderAsync(run.Event.GroupId, request.CurrentMemberId, cancellationToken))
        {
            return AppResult<EventWorkflowDto>.Forbidden("Only group leaders and co-leaders can update workflow steps.");
        }

        var step = run.Steps.FirstOrDefault(x => x.Id == request.StepId);
        if (step is null)
        {
            return AppResult<EventWorkflowDto>.NotFound("Workflow step not found.");
        }
        if (!string.IsNullOrWhiteSpace(step.IntegrationKey))
        {
            return AppResult<EventWorkflowDto>.Conflict("This step is managed by its dedicated event workflow.");
        }
        if (step.IsRequired && request.Status == EventWorkflowStepStatus.Skipped)
        {
            return AppResult<EventWorkflowDto>.Validation("A required workflow step cannot be skipped.");
        }
        if (!step.RequiresApproval && request.Status == EventWorkflowStepStatus.AwaitingApproval)
        {
            return AppResult<EventWorkflowDto>.Validation("This workflow step does not require approval.");
        }
        if (request.Status == EventWorkflowStepStatus.Completed &&
            step.Artifacts.Any(x => x.IsRequired && x.Status != EventArtifactStatus.Approved))
        {
            return AppResult<EventWorkflowDto>.Conflict("Approve every required output before completing this step.");
        }
        if (request.AssignedMemberId.HasValue &&
            !await groupAuthorizationService.IsApprovedMemberAsync(run.Event.GroupId, request.AssignedMemberId.Value, cancellationToken))
        {
            return AppResult<EventWorkflowDto>.Validation("The assigned person must be an approved group member.");
        }

        var now = DateTime.UtcNow;
        step.Status = request.Status;
        step.AssignedMemberId = request.AssignedMemberId;
        step.DueUtc = request.DueUtc;
        step.CompletedByMemberId = request.Status == EventWorkflowStepStatus.Completed ? request.CurrentMemberId : null;
        step.CompletedUtc = request.Status == EventWorkflowStepStatus.Completed ? now : null;
        step.UpdatedUtc = now;
        EventWorkflowDefinition.RecalculateRun(run, now);
        await dbContext.SaveChangesAsync(cancellationToken);
        return AppResult<EventWorkflowDto>.Success(EventWorkflowDefinition.ToDto(run));
    }
}
