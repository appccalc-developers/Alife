using Alife.Domain.Enums;

namespace Alife.Domain.Entities;

public class Page
{
	public Guid Id { get; set; }
	public PageScope Scope { get; set; }
	public Guid? OwnerGroupId { get; set; }
	public Guid CreatedByMemberId { get; set; }
	public string Title { get; set; } = string.Empty;
	public string? Description { get; set; }
	public string TagsJson { get; set; } = "[]";
	public string TitleDisplayStyle { get; set; } = "Default";
	public string Slug { get; set; } = string.Empty;
	public string Language { get; set; } = "en";
	public PageVisibility Visibility { get; set; }
	public DateTime UpdatedUtc { get; set; }
	public bool IsDeleted { get; set; }

	public Group? OwnerGroup { get; set; }
	public Member CreatedByMember { get; set; } = null!;
	public ICollection<Section> Sections { get; set; } = [];
}
