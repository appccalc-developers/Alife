using Alife.Domain.Enums;

namespace Alife.Domain.Entities;

public class Link
{
	public Guid Id { get; set; }
	public Guid OwnerSectionId { get; set; }
	public LinkType Type { get; set; }
	public Guid? TargetGroupId { get; set; }
	public Guid? TargetPageId { get; set; }
	public string Title { get; set; } = string.Empty;
	public string? ImageUrl { get; set; }
	public int SortOrder { get; set; }

	public Section OwnerSection { get; set; } = null!;
}