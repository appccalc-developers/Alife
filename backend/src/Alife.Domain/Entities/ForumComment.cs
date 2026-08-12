using Alife.Domain.Enums;

namespace Alife.Domain.Entities;

public class ForumComment
{
	public Guid Id { get; set; }
	public Guid PostId { get; set; }
	public Guid? ParentCommentId { get; set; }
	public Guid AuthorMemberId { get; set; }
	public string BodyJson { get; set; } = "{}";
	public string MediaJson { get; set; } = "[]";
	public ForumCommentVisibility Visibility { get; set; } = ForumCommentVisibility.Public;
	public bool IsHidden { get; set; }
	public DateTime CreatedUtc { get; set; }
	public DateTime UpdatedUtc { get; set; }
	public DateTime? DeletedUtc { get; set; }

	public ForumPost Post { get; set; } = null!;
	public ForumComment? ParentComment { get; set; }
	public ICollection<ForumComment> Replies { get; set; } = new List<ForumComment>();
	public Member AuthorMember { get; set; } = null!;
}
