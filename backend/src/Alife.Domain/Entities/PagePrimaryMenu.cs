namespace Alife.Domain.Entities;

public class PagePrimaryMenu
{
    public Guid Id { get; set; }
    public string NameJson { get; set; } = "{}";
    public int SortOrder { get; set; }
    public DateTime CreatedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }

    public ICollection<PagePublicationReview> PublicationReviews { get; set; } = [];
}
