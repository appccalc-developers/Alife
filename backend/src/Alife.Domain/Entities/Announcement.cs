using Alife.Domain.Enums;

namespace Alife.Domain.Entities;

public class Announcement
{
    public Guid Id { get; set; }
    public Guid GroupId { get; set; }
    public string TitleJson { get; set; } = "{}";
    public string SummaryJson { get; set; } = "{}";
    public string? ContentJson { get; set; }
    public AnnouncementAudience Audience { get; set; }
    public AnnouncementPriority Priority { get; set; }
    public AnnouncementStatus Status { get; set; }
    public DateTime PublishUtc { get; set; }
    public DateTime? ExpireUtc { get; set; }
    public bool IsPinned { get; set; }
    public Guid CreatedByMemberId { get; set; }
    public DateTime CreatedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }

    public Group Group { get; set; } = null!;
    public Member CreatedByMember { get; set; } = null!;
    public ICollection<NotificationMessage> Notifications { get; set; } = [];
}
