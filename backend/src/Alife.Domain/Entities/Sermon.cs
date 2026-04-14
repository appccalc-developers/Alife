namespace Alife.Domain.Entities;

public class Sermon
{
    public Guid Id { get; set; }
    public string YoutubeVideoId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string SpeakerName { get; set; } = string.Empty;
    public string? ThumbnailUrl { get; set; }
    public string? VideoUrl { get; set; }
    public DateTime? PreachedAtUtc { get; set; }
    public int SortOrder { get; set; }
    public DateTime SyncedUtc { get; set; }
}
