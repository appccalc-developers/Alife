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

namespace Alife.Application.Events.Commands.UpdateEventPreparationTaskStatus;

public sealed class UpdateEventPreparationTaskStatusCommandHandler(IAlifeDbContext db, IGroupAuthorizationService authorization)
    : IRequestHandler<UpdateEventPreparationTaskStatusCommand, AppResult<EventPreparationTaskDto>>
{
    public async Task<AppResult<EventPreparationTaskDto>> Handle(UpdateEventPreparationTaskStatusCommand request, CancellationToken cancellationToken)
    {
        var task = await db.EventPreparationTasks
            .Include(x => x.Event).ThenInclude(x => x.Plan)!.ThenInclude(x => x!.Modules)
            .Include(x => x.Event).ThenInclude(x => x.Plan)!.ThenInclude(x => x!.ReadinessGates).ThenInclude(x => x.ModuleInstance)
            .Include(x => x.Event).ThenInclude(x => x.PreparationTasks).ThenInclude(x => x.Dependencies).ThenInclude(x => x.DependsOnTask)
            .Include(x => x.AssignedMember)
            .Include(x => x.Dependencies).ThenInclude(x => x.DependsOnTask)
            .FirstOrDefaultAsync(x => x.Id == request.TaskId && x.EventId == request.EventId, cancellationToken);
        if (task is null) return AppResult<EventPreparationTaskDto>.NotFound("Preparation task not found.");
        var leader = await authorization.IsLeaderOrCoLeaderAsync(task.Event.GroupId, request.CurrentMemberId, cancellationToken);
        if (!leader && task.AssignedMemberId != request.CurrentMemberId)
            return AppResult<EventPreparationTaskDto>.Forbidden("Only the assigned member or an event leader can update this task.");
        if (!leader && request.Status == EventPreparationTaskStatus.Cancelled)
            return AppResult<EventPreparationTaskDto>.Forbidden("Only an event leader can cancel a preparation task.");
        if (request.Status is EventPreparationTaskStatus.InProgress or EventPreparationTaskStatus.Completed &&
            EventPreparationTaskPolicy.IsBlocked(task))
            return AppResult<EventPreparationTaskDto>.Conflict("Complete the prerequisite tasks before starting this one.");

        var previous = task.Status;
        var now = DateTime.UtcNow;
        task.Status = request.Status;
        task.UpdatedByMemberId = request.CurrentMemberId;
        task.UpdatedUtc = now;
        if (task.Event.Plan is not null)
            EventPreparationPlanSync.Apply(task.Event.Plan, task.Event.PreparationTasks, task.Event.StartDate, request.CurrentMemberId, now);

        if (request.Status is EventPreparationTaskStatus.Completed or EventPreparationTaskStatus.Cancelled && task.AssignedMemberId is Guid assignedId)
        {
            var taskIdText = task.Id.ToString();
            var notifications = await db.NotificationMessages.Where(x =>
                x.EventId == task.EventId && x.RecipientMemberId == assignedId &&
                x.ActionType == "event.preparation.task.assigned" && x.ReadUtc == null &&
                x.ActionDataJson.Contains(taskIdText)).ToListAsync(cancellationToken);
            foreach (var notification in notifications) { notification.ReadUtc = now; notification.UpdatedUtc = now; }
        }
        db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(), ActorMemberId = request.CurrentMemberId, TargetMemberId = task.AssignedMemberId,
            GroupId = task.Event.GroupId, EventId = task.EventId, Action = "event.preparation-task.status-updated",
            EntityType = nameof(EventPreparationTask), EntityId = task.Id,
            MetadataJson = JsonSerializer.Serialize(new { previous = previous.ToString(), current = request.Status.ToString() }),
            OccurredUtc = now
        });
        await db.SaveChangesAsync(cancellationToken);
        return AppResult<EventPreparationTaskDto>.Success(EventPreparationTaskPolicy.ToDto(task));
    }
}
