namespace Alife.Domain.Entities;

public enum EventPreparationReopenStatus { Pending = 0, Approved = 1, Rejected = 2 }

public sealed class EventPreparationReopenRequest
{
    public Guid Id { get; set; }
    public Guid EventId { get; set; }
    public Guid EventPackageId { get; set; }
    public Guid RequestedByMemberId { get; set; }
    public string ReasonEn { get; set; } = string.Empty;
    public string ReasonZh { get; set; } = string.Empty;
    public DateTime RequestedUtc { get; set; }
    public EventPreparationReopenStatus Status { get; set; }
    public Guid? ReviewedByMemberId { get; set; }
    public DateTime? ReviewedUtc { get; set; }
    public string? ReviewReasonEn { get; set; }
    public string? ReviewReasonZh { get; set; }
    public Guid ConcurrencyToken { get; set; } = Guid.NewGuid();
    public GroupEvent Event { get; set; } = null!;
    public EventPackage EventPackage { get; set; } = null!;
}
