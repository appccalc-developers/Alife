using Alife.Domain.Enums;

namespace Alife.Domain.Entities;

public class ContactProfile
{
	public Guid Id { get; set; }
	public Guid MemberId { get; set; }
	public Guid OwnerGroupId { get; set; }
	public string NameJson { get; set; } = "{}";
	public string RoleJson { get; set; } = "{}";
	public string? PhotoUrl { get; set; }
	public string? NotesJson { get; set; }
	public string? Phone { get; set; }
	public string? Email { get; set; }
	public ContactProfileVisibility Visibility { get; set; }
	public DateTime CreatedUtc { get; set; }
	public DateTime UpdatedUtc { get; set; }
	public bool IsDeleted { get; set; }

	public Member Member { get; set; } = null!;
	public Group OwnerGroup { get; set; } = null!;
	public ICollection<EventContactProfile> Events { get; set; } = [];
	public ICollection<ContactInquiry> Inquiries { get; set; } = [];
}
