namespace Alife.Domain.Entities;

public class AlbumPhoto
{
    public Guid Id { get; set; }
    public Guid AlbumId { get; set; }
    public Guid FileAssetId { get; set; }
    public string? CaptionJson { get; set; }
    public int SortOrder { get; set; }
    public DateTime CreatedUtc { get; set; }

    public Album Album { get; set; } = null!;
    public FileAsset FileAsset { get; set; } = null!;
}
