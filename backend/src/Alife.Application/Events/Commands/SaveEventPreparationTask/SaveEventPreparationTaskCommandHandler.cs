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

namespace Alife.Application.Events.Commands.SaveEventPreparationTask;

public sealed class SaveEventPreparationTaskCommandHandler(IAlifeDbContext db, IGroupAuthorizationService authorization)
    : IRequestHandler<SaveEventPreparationTaskCommand, AppResult<EventPreparationTaskDto>>
{
    public async Task<AppResult<EventPreparationTaskDto>> Handle(SaveEventPreparationTaskCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.TitleEn) && string.IsNullOrWhiteSpace(request.TitleZh))
            return AppResult<EventPreparationTaskDto>.Validation("An English or Chinese task title is required.");
        if (request.TitleEn.Trim().Length > 300 || request.TitleZh.Trim().Length > 300 ||
            request.DescriptionEn.Trim().Length > 2000 || request.DescriptionZh.Trim().Length > 2000)
            return AppResult<EventPreparationTaskDto>.Validation("Task text is too long.");
        var moduleKey = request.ModuleKey.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(moduleKey) || moduleKey.Length > 80)
            return AppResult<EventPreparationTaskDto>.Validation("Choose the preparation area for this task.");
        var dependencyIds = request.DependencyTaskIds.Distinct().ToArray();
        if (dependencyIds.Length > 20)
            return AppResult<EventPreparationTaskDto>.Validation("A task cannot have more than 20 prerequisites.");

        var groupEvent = await db.GroupEvents
            .Include(x => x.PreparationTasks).ThenInclude(x => x.AssignedMember)
            .Include(x => x.PreparationTasks).ThenInclude(x => x.Dependencies).ThenInclude(x => x.DependsOnTask)
            .Include(x => x.Plan).ThenInclude(x => x!.Modules)
            .Include(x => x.Plan).ThenInclude(x => x!.Occurrences)
            .Include(x => x.Plan).ThenInclude(x => x!.ReadinessGates).ThenInclude(x => x.ModuleInstance)
            .Include(x => x.Plan).ThenInclude(x => x!.Revisions)
            .FirstOrDefaultAsync(x => x.Id == request.EventId, cancellationToken);
        if (groupEvent is null) return AppResult<EventPreparationTaskDto>.NotFound("Event not found.");
        if (!await authorization.IsLeaderOrCoLeaderAsync(groupEvent.GroupId, request.CurrentMemberId, cancellationToken))
            return AppResult<EventPreparationTaskDto>.Forbidden("Only event leaders can create or assign preparation tasks.");
        if (groupEvent.Plan is null) return AppResult<EventPreparationTaskDto>.Conflict("The event plan has not been created yet.");
        if (moduleKey != "general" && moduleKey != EventPreparationPlanSync.ModuleKey && !groupEvent.Plan.Modules.Any(x => x.ModuleKey == moduleKey))
            return AppResult<EventPreparationTaskDto>.Validation("The selected preparation area is not part of this event.");

        Member? assignedMember = null;
        if (request.AssignedMemberId is Guid assignedId)
        {
            var approved = await db.GroupMemberships.AnyAsync(x =>
                x.GroupId == groupEvent.GroupId && x.MemberId == assignedId && x.Status == MembershipStatus.Approved,
                cancellationToken);
            if (!approved) return AppResult<EventPreparationTaskDto>.Validation("Tasks can be assigned only to approved group members.");
            assignedMember = await db.Members.FirstAsync(x => x.Id == assignedId, cancellationToken);
        }

        var now = DateTime.UtcNow;
        EventPreparationTask task;
        Guid? previousAssignee = null;
        if (request.TaskId is Guid taskId)
        {
            task = groupEvent.PreparationTasks.FirstOrDefault(x => x.Id == taskId) ?? null!;
            if (task is null) return AppResult<EventPreparationTaskDto>.NotFound("Preparation task not found.");
            previousAssignee = task.AssignedMemberId;
        }
        else
        {
            task = new EventPreparationTask
            {
                Id = Guid.NewGuid(), EventId = groupEvent.Id, CreatedByMemberId = request.CurrentMemberId,
                CreatedUtc = now, Status = EventPreparationTaskStatus.Todo, Event = groupEvent
            };
            groupEvent.PreparationTasks.Add(task);
            db.EventPreparationTasks.Add(task);
        }
        if (dependencyIds.Contains(task.Id))
            return AppResult<EventPreparationTaskDto>.Validation("A task cannot depend on itself.");
        var eventTaskIds = groupEvent.PreparationTasks.Select(x => x.Id).ToHashSet();
        if (dependencyIds.Any(x => !eventTaskIds.Contains(x)))
            return AppResult<EventPreparationTaskDto>.Validation("A prerequisite task does not belong to this event.");
        if (EventPreparationTaskPolicy.HasCycle(task.Id, dependencyIds, groupEvent.PreparationTasks))
            return AppResult<EventPreparationTaskDto>.Validation("This dependency would create a circular task chain.");

        var existingDependencies = task.Dependencies.ToDictionary(x => x.DependsOnTaskId);
        var oldDependencies = existingDependencies.Keys.Order().ToArray();
        foreach (var dependency in existingDependencies.Values.Where(x => !dependencyIds.Contains(x.DependsOnTaskId)).ToArray())
        {
            task.Dependencies.Remove(dependency);
            db.EventPreparationTaskDependencies.Remove(dependency);
        }
        foreach (var dependencyId in dependencyIds.Where(x => !existingDependencies.ContainsKey(x)))
        {
            var dependency = new EventPreparationTaskDependency
            {
                TaskId = task.Id, DependsOnTaskId = dependencyId, Task = task,
                DependsOnTask = groupEvent.PreparationTasks.Single(x => x.Id == dependencyId)
            };
            task.Dependencies.Add(dependency);
            db.EventPreparationTaskDependencies.Add(dependency);
        }
        if (!oldDependencies.SequenceEqual(dependencyIds.Order()) && task.Status == EventPreparationTaskStatus.Completed)
            task.Status = EventPreparationTaskStatus.Todo;

        task.ModuleKey = moduleKey;
        task.TitleEn = Fallback(request.TitleEn, request.TitleZh);
        task.TitleZh = Fallback(request.TitleZh, request.TitleEn);
        task.DescriptionEn = request.DescriptionEn.Trim();
        task.DescriptionZh = request.DescriptionZh.Trim();
        task.AssignedMemberId = request.AssignedMemberId;
        task.AssignedMember = assignedMember;
        task.DueUtc = request.DueUtc?.ToUniversalTime();
        task.IsRequired = request.IsRequired;
        task.UpdatedByMemberId = request.CurrentMemberId;
        task.UpdatedUtc = now;

        var knownModuleIds = groupEvent.Plan.Modules.Select(x => x.Id).ToHashSet();
        var knownGateIds = groupEvent.Plan.ReadinessGates.Select(x => x.Id).ToHashSet();
        var knownRevisionIds = groupEvent.Plan.Revisions.Select(x => x.Id).ToHashSet();
        EventPreparationPlanSync.Apply(groupEvent.Plan, groupEvent.PreparationTasks, groupEvent.StartDate, request.CurrentMemberId, now);
        EventCompositionFactory.RecordPlanChange(groupEvent.Plan, groupEvent.EventDataJson, request.CurrentMemberId, "Preparation task configuration updated", now);
        db.EventModuleInstances.AddRange(groupEvent.Plan.Modules.Where(x => !knownModuleIds.Contains(x.Id)));
        db.EventReadinessGates.AddRange(groupEvent.Plan.ReadinessGates.Where(x => !knownGateIds.Contains(x.Id)));
        db.EventPlanRevisions.AddRange(groupEvent.Plan.Revisions.Where(x => !knownRevisionIds.Contains(x.Id)));

        if (assignedMember is not null && previousAssignee != assignedMember.Id)
        {
            db.NotificationMessages.Add(new NotificationMessage
            {
                Id = Guid.NewGuid(), RecipientMemberId = assignedMember.Id, CreatedByMemberId = request.CurrentMemberId,
                GroupId = groupEvent.GroupId, EventId = groupEvent.Id, OccurredUtc = now,
                ActionType = "event.preparation.task.assigned",
                ActionDataJson = JsonSerializer.Serialize(new
                {
                    taskId = task.Id,
                    title = new { en = "Event preparation task assigned", zh = "收到活动筹备任务" },
                    body = new { en = $"{groupEvent.TitleEn}: {task.TitleEn}", zh = $"{groupEvent.TitleZh}：{task.TitleZh}" },
                    actionUrl = $"/groups/{groupEvent.GroupId}/events/{groupEvent.Id}/my-tasks"
                }),
                CreatedUtc = now, UpdatedUtc = now
            });
        }
        db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(), ActorMemberId = request.CurrentMemberId, TargetMemberId = request.AssignedMemberId,
            GroupId = groupEvent.GroupId, EventId = groupEvent.Id, Action = "event.preparation-task.saved",
            EntityType = nameof(EventPreparationTask), EntityId = task.Id,
            MetadataJson = JsonSerializer.Serialize(new { task.ModuleKey, task.IsRequired, dependencyCount = dependencyIds.Length }),
            OccurredUtc = now
        });
        await db.SaveChangesAsync(cancellationToken);
        return AppResult<EventPreparationTaskDto>.Success(EventPreparationTaskPolicy.ToDto(task));
    }

    private static string Fallback(string primary, string secondary) =>
        string.IsNullOrWhiteSpace(primary) ? secondary.Trim() : primary.Trim();
}
