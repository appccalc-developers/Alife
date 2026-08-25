namespace Alife.Domain.Entities;

public class Venue
{
    public Guid Id { get; set; }
    public Guid ChurchGroupId { get; set; }
    public Guid CreatedByMemberId { get; set; }
    public Guid UpdatedByMemberId { get; set; }
    public string NameEn { get; set; } = string.Empty;
    public string NameZh { get; set; } = string.Empty;
    public string DescriptionEn { get; set; } = string.Empty;
    public string DescriptionZh { get; set; } = string.Empty;
    public string AddressEn { get; set; } = string.Empty;
    public string AddressZh { get; set; } = string.Empty;
    public string TimeZoneId { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime CreatedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }

    public Group ChurchGroup { get; set; } = null!;
    public Member CreatedByMember { get; set; } = null!;
    public Member UpdatedByMember { get; set; } = null!;
    public ICollection<VenueSpace> Spaces { get; set; } = [];
}
