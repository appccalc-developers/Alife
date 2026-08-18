using System.Text.Json;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
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
            .Where(x => x.IsActive && x.Code == code &&
                (x.OwnerGroupId == null || x.OwnerGroupId == groupEvent.GroupId))
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

        var run = EventWorkflowRunFactory.Create(
            groupEvent,
            template,
            stages,
            request.CurrentMemberId,
            DateTime.UtcNow);
        dbContext.EventWorkflowRuns.Add(run);
        await dbContext.SaveChangesAsync(cancellationToken);
        return AppResult<EventWorkflowDto>.Success(EventWorkflowDefinition.ToDto(run));
    }
}
