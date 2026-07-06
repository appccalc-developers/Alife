using Alife.Domain.Enums;

namespace Alife.Domain.Entities;

public class ForumPost
{
	public Guid Id { get; set; }
	public Guid CategoryId { get; set; }
	public Guid? GroupId { get; set; }
	public Guid AuthorMemberId { get; set; }
	public string TitleJson { get; set; } = "{}";
	public string BodyJson { get; set; } = "{}";
	public string MediaJson { get; set; } = "[]";
	public ForumPostVisibility Visibility { get; set; } = ForumPostVisibility.MembersOnly;
	public bool IsPinned { get; set; }
	public bool IsLocked { get; set; }
	public bool IsHidden { get; set; }
	public int CommentCount { get; set; }
	public DateTime? LastCommentUtc { get; set; }
	public Guid? LastCommentMemberId { get; set; }
	public DateTime CreatedUtc { get; set; }
	public DateTime UpdatedUtc { get; set; }
	public DateTime? DeletedUtc { get; set; }

	public ForumCategory Category { get; set; } = null!;
	public Group? Group { get; set; }
	public Member AuthorMember { get; set; } = null!;
	public Member? LastCommentMember { get; set; }
	public ICollection<ForumComment> Comments { get; set; } = [];
}
