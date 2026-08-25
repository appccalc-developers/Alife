using Alife.Application.Events.Dtos;
using Alife.Domain.Entities;
using Alife.Domain.Enums;

namespace Alife.Application.Events.Services;

public static class EventPreparationTaskPolicy
{
    public static EventPreparationTask[] RequiredTasks(IEnumerable<EventPreparationTask> tasks) => tasks
        .Where(x => x.IsRequired && x.Status != EventPreparationTaskStatus.Cancelled)
        .ToArray();

    public static bool IsBlocked(EventPreparationTask task) => task.Dependencies
        .Any(x => x.DependsOnTask.Status != EventPreparationTaskStatus.Completed);

    public static bool IsDueAfterEvent(EventPreparationTask task, DateTime eventStartUtc) =>
        task.DueUtc is DateTime dueUtc && dueUtc > eventStartUtc;

    public static bool IsOverdue(EventPreparationTask task, DateTime nowUtc) =>
        task.Status != EventPreparationTaskStatus.Completed && task.DueUtc is DateTime dueUtc && dueUtc < nowUtc;

    public static EventModuleStatus ModuleStatus(
        IEnumerable<EventPreparationTask> tasks,
        DateTime eventStartUtc,
        DateTime nowUtc)
    {
        var required = RequiredTasks(tasks);
        if (required.Length == 0) return EventModuleStatus.NotConfigured;
        if (required.Any(x => x.AssignedMemberId is null || x.DueUtc is null ||
            IsDueAfterEvent(x, eventStartUtc) || IsOverdue(x, nowUtc) || IsBlocked(x)))
            return EventModuleStatus.Blocked;
        return required.All(x => x.Status == EventPreparationTaskStatus.Completed)
            ? EventModuleStatus.Ready
            : EventModuleStatus.Configuring;
    }

    public static EventPreparationTaskDto ToDto(EventPreparationTask task) => new(
        task.Id,
        task.ModuleKey,
        new WorkflowTextDto(task.TitleEn, task.TitleZh),
        new WorkflowTextDto(task.DescriptionEn, task.DescriptionZh),
        task.AssignedMemberId,
        task.AssignedMember?.DisplayName,
        task.DueUtc,
        task.IsRequired,
        task.Status,
        task.Dependencies.Select(x => x.DependsOnTaskId).ToArray(),
        IsBlocked(task),
        task.UpdatedUtc);

    public static bool HasCycle(Guid taskId, IReadOnlyCollection<Guid> dependencies, IEnumerable<EventPreparationTask> allTasks)
    {
        var graph = allTasks.ToDictionary(
            x => x.Id,
            x => (IReadOnlyCollection<Guid>)x.Dependencies.Select(d => d.DependsOnTaskId).ToArray());
        graph[taskId] = dependencies;
        var visiting = new HashSet<Guid>();
        var visited = new HashSet<Guid>();
        return Visit(taskId);

        bool Visit(Guid id)
        {
            if (!visiting.Add(id)) return true;
            if (visited.Contains(id)) { visiting.Remove(id); return false; }
            if (graph.TryGetValue(id, out var next) && next.Any(Visit)) return true;
            visiting.Remove(id);
            visited.Add(id);
            return false;
        }
    }
}
