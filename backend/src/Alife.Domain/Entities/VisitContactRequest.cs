namespace Alife.Domain.Entities;

public class VisitContactRequest
{
    public Guid Id { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public string? Salutation { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? PreferredLanguage { get; set; }
    public string? Message { get; set; }
    public string? SourcePage { get; set; }
    public string Status { get; set; } = "new";
    public DateTime SubmittedUtc { get; set; }
    public DateTime? HandledUtc { get; set; }
    public Guid? HandledByMemberId { get; set; }
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public DateTime CreatedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }

    public Member? HandledByMember { get; set; }
}
