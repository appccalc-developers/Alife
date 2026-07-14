using Alife.Domain.Enums;

namespace Alife.Domain.Entities;

public class Album
{
    public Guid Id { get; set; }
    public Guid GroupId { get; set; }
    public Guid? ParentAlbumId { get; set; }
    public string NameJson { get; set; } = "{}";
    public string? DescriptionJson { get; set; }
    public AlbumVisibility Visibility { get; set; }
    public int SortOrder { get; set; }
    public Guid CreatedByMemberId { get; set; }
    public DateTime CreatedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }
    public bool IsDeleted { get; set; }

    public Group Group { get; set; } = null!;
    public Album? ParentAlbum { get; set; }
    public ICollection<Album> Children { get; set; } = [];
    public ICollection<AlbumPhoto> Photos { get; set; } = [];
}
