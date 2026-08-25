namespace Alife.Domain.Entities;

public class EventPreparationTaskDependency
{
    public Guid TaskId { get; set; }
    public Guid DependsOnTaskId { get; set; }
    public EventPreparationTask Task { get; set; } = null!;
    public EventPreparationTask DependsOnTask { get; set; } = null!;
}
