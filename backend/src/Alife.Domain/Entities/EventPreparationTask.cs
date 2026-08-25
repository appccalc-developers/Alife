using Alife.Domain.Enums;

namespace Alife.Domain.Entities;

public class EventPreparationTask
{
    public Guid Id { get; set; }
    public Guid EventId { get; set; }
    public string ModuleKey { get; set; } = string.Empty;
    public string TitleEn { get; set; } = string.Empty;
    public string TitleZh { get; set; } = string.Empty;
    public string DescriptionEn { get; set; } = string.Empty;
    public string DescriptionZh { get; set; } = string.Empty;
    public Guid? AssignedMemberId { get; set; }
    public DateTime? DueUtc { get; set; }
    public bool IsRequired { get; set; }
    public EventPreparationTaskStatus Status { get; set; }
    public Guid CreatedByMemberId { get; set; }
    public Guid UpdatedByMemberId { get; set; }
    public DateTime CreatedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }

    public GroupEvent Event { get; set; } = null!;
    public Member? AssignedMember { get; set; }
    public Member CreatedByMember { get; set; } = null!;
    public Member UpdatedByMember { get; set; } = null!;
    public ICollection<EventPreparationTaskDependency> Dependencies { get; set; } = [];
    public ICollection<EventPreparationTaskDependency> Dependents { get; set; } = [];
}
