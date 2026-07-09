using System.Net.Http.Json;
using System.Globalization;
using Alife.Application.Abstractions.Integrations;
using Alife.Application.Sermons.Services;
using Alife.Domain.Entities;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Alife.Infrastructure.Integrations;

public class YoutubeService(
    AlifeDbContext dbContext,
    IHttpClientFactory httpClientFactory,
    IConfiguration configuration,
    ILogger<YoutubeService> logger,
    ISermonCacheInvalidationService sermonCacheInvalidationService) : IYoutubeService
{
    private const int MaxResultsPerPage = 50;
    private const int MaxSermonsToSync = 100;

    public async Task SyncSermonsAsync(CancellationToken cancellationToken = default)
    {
        var apiKey = configuration["YOUTUBE_API_KEY"];
        var playlistId = configuration["YOUTUBE_PLAYLIST_ID"];

        if (string.IsNullOrWhiteSpace(apiKey) || string.IsNullOrWhiteSpace(playlistId))
        {
            logger.LogWarning(
                "Skipping sermon sync because YouTube configuration is missing. YOUTUBE_API_KEY set: {HasApiKey}; YOUTUBE_PLAYLIST_ID set: {HasPlaylistId}",
                !string.IsNullOrWhiteSpace(apiKey),
                !string.IsNullOrWhiteSpace(playlistId));
            return;
        }

        var latestSermons = await FetchLatestPlaylistSermonsAsync(apiKey, playlistId, cancellationToken);
        if (latestSermons.Count == 0)
        {
            logger.LogWarning("YouTube playlist sync returned zero sermons for playlist {PlaylistId}.", playlistId);
            return;
        }

        var videoIds = latestSermons.Select(x => x.VideoId).ToHashSet(StringComparer.OrdinalIgnoreCase);

        var existingByVideoId = await dbContext.Sermons
            .IgnoreQueryFilters()
            .Where(x => videoIds.Contains(x.YoutubeVideoId))
            .ToDictionaryAsync(x => x.YoutubeVideoId, StringComparer.OrdinalIgnoreCase, cancellationToken);

        var now = DateTime.UtcNow;
        var hasPublicPayloadChanges = false;

        for (var index = 0; index < latestSermons.Count; index++)
        {
            var item = latestSermons[index];
            if (existingByVideoId.TryGetValue(item.VideoId, out var existing))
            {
                var changed = existing.IsDeleted ||
                              existing.Title != item.Title ||
                              existing.SpeakerName != item.SpeakerName ||
                              existing.ThumbnailUrl != item.ThumbnailUrl ||
                              existing.VideoUrl != item.VideoUrl ||
                              existing.PreachedAtUtc != item.PreachedAtUtc ||
                              existing.SortOrder != index;

                existing.Title = item.Title;
                existing.SpeakerName = item.SpeakerName;
                existing.ThumbnailUrl = item.ThumbnailUrl;
                existing.VideoUrl = item.VideoUrl;
                existing.PreachedAtUtc = item.PreachedAtUtc;
                existing.SortOrder = index;
                existing.SyncedUtc = now;
                existing.IsDeleted = false;
                if (changed)
                {
                    hasPublicPayloadChanges = true;
                    existing.UpdatedUtc = now;
                }
                continue;
            }

            hasPublicPayloadChanges = true;
            dbContext.Sermons.Add(new Sermon
            {
                Id = Guid.NewGuid(),
                YoutubeVideoId = item.VideoId,
                Title = item.Title,
                SpeakerName = item.SpeakerName,
                ThumbnailUrl = item.ThumbnailUrl,
                VideoUrl = item.VideoUrl,
                PreachedAtUtc = item.PreachedAtUtc,
                SortOrder = index,
                SyncedUtc = now,
                UpdatedUtc = now,
            });
        }

        var staleSermons = await dbContext.Sermons
            .IgnoreQueryFilters()
            .Where(x => !videoIds.Contains(x.YoutubeVideoId))
            .ToListAsync(cancellationToken);

        var removedCount = 0;
        foreach (var staleSermon in staleSermons.Where(x => !x.IsDeleted))
        {
            hasPublicPayloadChanges = true;
            removedCount++;
            staleSermon.IsDeleted = true;
            staleSermon.UpdatedUtc = now;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        if (hasPublicPayloadChanges)
        {
            await sermonCacheInvalidationService.RemoveAllAsync(cancellationToken);
        }

        logger.LogInformation(
            "Synced {Count} sermons from YouTube playlist {PlaylistId}. Removed {RemovedCount} stale rows. Public payload changed: {HasPublicPayloadChanges}.",
            latestSermons.Count,
            playlistId,
            removedCount,
            hasPublicPayloadChanges);
    }

    private async Task<List<PlaylistSermonItem>> FetchLatestPlaylistSermonsAsync(
        string apiKey,
        string playlistId,
        CancellationToken cancellationToken)
    {
        var client = httpClientFactory.CreateClient("youtube");
        var sermons = new List<PlaylistSermonItem>(MaxSermonsToSync);
        string? nextPageToken = null;

        while (sermons.Count < MaxSermonsToSync)
        {
            var requestUri = BuildPlaylistItemsUri(apiKey, playlistId, nextPageToken);
            var response = await client.GetAsync(requestUri, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync(cancellationToken);
                logger.LogWarning(
                    "YouTube playlist fetch failed with {StatusCode}. Body: {Body}",
                    (int)response.StatusCode,
                    body);
                break;
            }

            var payload = await response.Content.ReadFromJsonAsync<YoutubePlaylistItemsResponse>(cancellationToken: cancellationToken);
            if (payload?.Items is null || payload.Items.Count == 0)
            {
                break;
            }

            foreach (var item in payload.Items)
            {
                var videoId = item.Snippet?.ResourceId?.VideoId?.Trim();
                if (string.IsNullOrWhiteSpace(videoId))
                {
                    continue;
                }

                var title = item.Snippet?.Title?.Trim();
                if (string.IsNullOrWhiteSpace(title))
                {
                    title = "Untitled Sermon";
                }

                var speakerName = item.Snippet?.VideoOwnerChannelTitle?.Trim();
                if (string.IsNullOrWhiteSpace(speakerName))
                {
                    speakerName = item.Snippet?.ChannelTitle?.Trim();
                }

                if (string.IsNullOrWhiteSpace(speakerName))
                {
                    speakerName = "Guest Speaker";
                }

                var thumbnailUrl =
                    item.Snippet?.Thumbnails?.Standard?.Url ??
                    item.Snippet?.Thumbnails?.High?.Url ??
                    item.Snippet?.Thumbnails?.Medium?.Url ??
                    item.Snippet?.Thumbnails?.Default?.Url;

                var preachedAtUtc = ResolvePreachedAtUtc(title, item.Snippet?.PublishedAt);

                sermons.Add(new PlaylistSermonItem(
                    videoId,
                    title,
                    speakerName,
                    thumbnailUrl,
                    $"https://www.youtube.com/watch?v={videoId}",
                    preachedAtUtc));

                if (sermons.Count >= MaxSermonsToSync)
                {
                    break;
                }
            }

            if (string.IsNullOrWhiteSpace(payload.NextPageToken))
            {
                break;
            }

            nextPageToken = payload.NextPageToken;
        }

        return sermons;
    }

    private static string BuildPlaylistItemsUri(string apiKey, string playlistId, string? nextPageToken)
    {
        var query = $"playlistItems?part=snippet&maxResults={MaxResultsPerPage}&playlistId={Uri.EscapeDataString(playlistId)}&key={Uri.EscapeDataString(apiKey)}";
        if (!string.IsNullOrWhiteSpace(nextPageToken))
        {
            query += $"&pageToken={Uri.EscapeDataString(nextPageToken)}";
        }

        return query;
    }

    private static DateTime? ResolvePreachedAtUtc(string title, string? publishedAt)
    {
        if (title.Length >= 10)
        {
            var titleDateText = title[..10].Trim().Replace(' ', '-');
            if (DateOnly.TryParseExact(
                    titleDateText,
                    "yyyy-MM-dd",
                    CultureInfo.InvariantCulture,
                    DateTimeStyles.None,
                    out var preachedAtDate))
            {
                return preachedAtDate.ToDateTime(new TimeOnly(22, 0), DateTimeKind.Utc);
            }
        }

        return DateTimeOffset.TryParse(
            publishedAt,
            CultureInfo.InvariantCulture,
            DateTimeStyles.AssumeUniversal,
            out var publishedAtOffset)
            ? publishedAtOffset.UtcDateTime
            : null;
    }

    private sealed record PlaylistSermonItem(
        string VideoId,
        string Title,
        string SpeakerName,
        string? ThumbnailUrl,
        string VideoUrl,
        DateTime? PreachedAtUtc);

    private sealed class YoutubePlaylistItemsResponse
    {
        public string? NextPageToken { get; set; }
        public List<YoutubePlaylistItem> Items { get; set; } = [];
    }

    private sealed class YoutubePlaylistItem
    {
        public YoutubeSnippet? Snippet { get; set; }
    }

    private sealed class YoutubeSnippet
    {
        public string? PublishedAt { get; set; }
        public string? Title { get; set; }
        public string? ChannelTitle { get; set; }
        public string? VideoOwnerChannelTitle { get; set; }
        public YoutubeResourceId? ResourceId { get; set; }
        public YoutubeThumbnails? Thumbnails { get; set; }
    }

    private sealed class YoutubeResourceId
    {
        public string? VideoId { get; set; }
    }

    private sealed class YoutubeThumbnails
    {
        public YoutubeThumbnail? Default { get; set; }
        public YoutubeThumbnail? Medium { get; set; }
        public YoutubeThumbnail? High { get; set; }
        public YoutubeThumbnail? Standard { get; set; }
    }

    private sealed class YoutubeThumbnail
    {
        public string? Url { get; set; }
    }
}
