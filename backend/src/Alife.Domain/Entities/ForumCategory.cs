namespace Alife.Domain.Entities;

public class ForumCategory
{
	public Guid Id { get; set; }
	public string NameJson { get; set; } = "{}";
	public string? DescriptionJson { get; set; }
	public int SortOrder { get; set; }
	public bool IsEnabled { get; set; } = true;
	public DateTime CreatedUtc { get; set; }
	public DateTime UpdatedUtc { get; set; }

	public ICollection<ForumPost> Posts { get; set; } = [];
}
