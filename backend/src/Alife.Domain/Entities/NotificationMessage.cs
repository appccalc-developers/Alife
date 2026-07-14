namespace Alife.Domain.Entities;

public class NotificationMessage
{
    public Guid Id { get; set; }
    public Guid RecipientMemberId { get; set; }
    public Guid CreatedByMemberId { get; set; }
    public Guid? GroupId { get; set; }
    public Guid? EventId { get; set; }
    public Guid? AnnouncementId { get; set; }
    public DateTime OccurredUtc { get; set; }
    public string ActionType { get; set; } = "";
    public string ActionDataJson { get; set; } = "{}";
    public string? ResponseDataJson { get; set; }
    public DateTime? ReadUtc { get; set; }
    public DateTime? RepliedUtc { get; set; }
    public DateTime CreatedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }

    public Member RecipientMember { get; set; } = null!;
    public Member CreatedByMember { get; set; } = null!;
    public Group? Group { get; set; }
    public GroupEvent? Event { get; set; }
    public Announcement? Announcement { get; set; }
}
