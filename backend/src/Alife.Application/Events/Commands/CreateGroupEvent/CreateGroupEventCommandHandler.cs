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

namespace Alife.Application.Events.Commands.CreateGroupEvent;

public sealed class CreateGroupEventCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IEventCacheInvalidationService eventCacheInvalidationService)
    : IRequestHandler<CreateGroupEventCommand, AppResult<GroupEventSummaryDto>>
{
    public async Task<AppResult<GroupEventSummaryDto>> Handle(CreateGroupEventCommand request, CancellationToken cancellationToken)
    {
        var canManage = await groupAuthorizationService.IsLeaderOrCoLeaderAsync(
            request.GroupId,
            request.CurrentMemberId,
            cancellationToken);

        if (!canManage)
        {
            return AppResult<GroupEventSummaryDto>.Forbidden("Only group leaders and co-leaders can create events.");
        }

        if (request.RamDataJson is not null && !EventRamPolicy.IsValidJson(request.RamDataJson))
        {
            return AppResult<GroupEventSummaryDto>.Validation("RAM data must be a JSON object.");
        }

        if (!EventVisibilityPolicy.TryReadVisibility(request.EventDataJson, out var visibility))
        {
            return AppResult<GroupEventSummaryDto>.Validation("Event data must be a JSON object with a supported visibility.");
        }

        var contactProfileIds = (request.ContactProfileIds ?? []).Distinct().ToArray();
        var validContactCount = await dbContext.ContactProfiles.AsNoTracking().CountAsync(
            x => x.OwnerGroupId == request.GroupId && contactProfileIds.Contains(x.Id), cancellationToken);
        if (validContactCount != contactProfileIds.Length)
        {
            return AppResult<GroupEventSummaryDto>.Validation("Every event contact must belong to the event group.");
        }

        EventWorkflowTemplate? workflowTemplate = null;
        IReadOnlyList<EventWorkflowStageDefinitionDto>? workflowStages = null;
        if (!string.IsNullOrWhiteSpace(request.WorkflowTemplateCode))
        {
            var templateCode = request.WorkflowTemplateCode.Trim().ToLowerInvariant();
            workflowTemplate = await dbContext.EventWorkflowTemplates
                .Where(x => x.IsActive && x.Code == templateCode &&
                    (x.OwnerGroupId == null || x.OwnerGroupId == request.GroupId))
                .OrderByDescending(x => x.Version)
                .FirstOrDefaultAsync(cancellationToken);
            if (workflowTemplate is null)
            {
                return AppResult<GroupEventSummaryDto>.NotFound("Workflow template not found.");
            }

            try
            {
                workflowStages = EventWorkflowDefinition.Parse(workflowTemplate.DefinitionJson);
            }
            catch (JsonException)
            {
                return AppResult<GroupEventSummaryDto>.Validation("The selected workflow template is invalid.");
            }
        }

        var now = DateTime.UtcNow;
        var ramAssessment = new EventRamAssessment
        {
            EventId = Guid.Empty,
            RamDataJson = request.RamDataJson ?? "{}",
            Status = EventRamStatus.Draft,
            CreatedUtc = now,
            UpdatedUtc = now
        };
        var groupEvent = new GroupEvent
        {
            Id = Guid.NewGuid(),
            GroupId = request.GroupId,
            CreatedByMemberId = request.CurrentMemberId,
            TitleEn = request.TitleEn,
            TitleZh = request.TitleZh,
            StartDate = request.StartDate,
            EndDate = request.EndDate,
            EventDataJson = request.EventDataJson,
            CreatedUtc = now,
            UpdatedUtc = now,
            RamAssessment = ramAssessment
        };
        ramAssessment.EventId = groupEvent.Id;

        dbContext.GroupEvents.Add(groupEvent);
        dbContext.EventRamAssessments.Add(ramAssessment);
        dbContext.EventContactProfiles.AddRange(contactProfileIds.Select(contactProfileId => new EventContactProfile
        {
            EventId = groupEvent.Id,
            ContactProfileId = contactProfileId
        }));
        if (workflowTemplate is not null && workflowStages is not null)
        {
            dbContext.EventWorkflowRuns.Add(EventWorkflowRunFactory.Create(
                groupEvent,
                workflowTemplate,
                workflowStages,
                request.CurrentMemberId,
                now));
        }

        // One SaveChanges call keeps event creation, RAM initialization and the
        // selected workflow snapshot atomic for relational database providers.
        await dbContext.SaveChangesAsync(cancellationToken);
        await eventCacheInvalidationService.RemoveGroupEventsAsync(request.GroupId, cancellationToken);

        return AppResult<GroupEventSummaryDto>.Success(ToDto(groupEvent, contactProfileIds, ramAssessment.Status, visibility));
    }

    private static GroupEventSummaryDto ToDto(GroupEvent e, IReadOnlyList<Guid> contactProfileIds, EventRamStatus ramStatus, string visibility) =>
        new(e.Id, e.GroupId, e.CreatedByMemberId, e.TitleEn, e.TitleZh,
            e.StartDate, e.EndDate, e.EventDataJson, e.CreatedUtc, e.UpdatedUtc, contactProfileIds, ramStatus, visibility);
}
