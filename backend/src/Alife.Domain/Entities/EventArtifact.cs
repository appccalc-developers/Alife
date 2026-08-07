using Alife.Domain.Enums;

namespace Alife.Domain.Entities;

public class EventArtifact
{
    public Guid Id { get; set; }
    public Guid EventId { get; set; }
    public Guid? WorkflowStepId { get; set; }
    public string ArtifactType { get; set; } = string.Empty;
    public string TitleEn { get; set; } = string.Empty;
    public string TitleZh { get; set; } = string.Empty;
    public bool IsRequired { get; set; }
    public EventArtifactStatus Status { get; set; } = EventArtifactStatus.Draft;
    public FileAssetVisibility Visibility { get; set; } = FileAssetVisibility.GroupVisible;
    public Guid? FileAssetId { get; set; }
    public string DataJson { get; set; } = "{}";
    public Guid CreatedByMemberId { get; set; }
    public Guid? ApprovedByMemberId { get; set; }
    public DateTime? ApprovedUtc { get; set; }
    public DateTime CreatedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }

    public GroupEvent Event { get; set; } = null!;
    public EventWorkflowStep? WorkflowStep { get; set; }
    public FileAsset? FileAsset { get; set; }
    public Member CreatedByMember { get; set; } = null!;
    public Member? ApprovedByMember { get; set; }
}
