namespace Alife.Domain.Entities;

public sealed class GroupRosterCapability
{
    public Guid Id { get; set; }
    public Guid GroupId { get; set; }
    public string Key { get; set; } = string.Empty;
    public string NameEn { get; set; } = string.Empty;
    public string NameZh { get; set; } = string.Empty;
    public string DescriptionEn { get; set; } = string.Empty;
    public string DescriptionZh { get; set; } = string.Empty;
    public bool RequiresExpiry { get; set; }
    public int? DefaultValidityDays { get; set; }
    public bool IsActive { get; set; } = true;
    public Guid CreatedByMemberId { get; set; }
    public Guid UpdatedByMemberId { get; set; }
    public DateTime CreatedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }

    public Group Group { get; set; } = null!;
}
