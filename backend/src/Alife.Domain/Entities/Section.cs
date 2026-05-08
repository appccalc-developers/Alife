using Alife.Domain.Enums;

namespace Alife.Domain.Entities;

public class Section
{
	public Guid Id { get; set; }
	public Guid PageId { get; set; }
	public int Order { get; set; }
	public SectionType Type { get; set; }
	public string ContentJson { get; set; } = "{}";
	public string StyleJson { get; set; } = "{}";
	public bool IsDeleted { get; set; }

	public Page Page { get; set; } = null!;
	public ICollection<Link> Links { get; set; } = [];
}
