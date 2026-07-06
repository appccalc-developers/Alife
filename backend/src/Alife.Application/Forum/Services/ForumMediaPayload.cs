using System.Text.Json;

namespace Alife.Application.Forum.Services;

internal static class ForumMediaPayload
{
	private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
	private static readonly HashSet<string> AllowedKinds = new(StringComparer.OrdinalIgnoreCase) { "image", "video" };

	public static bool TryNormalize(
		IReadOnlyList<ForumMediaInput>? media,
		int maxItems,
		bool allowVideo,
		int maxVideos,
		out string mediaJson,
		out string? error)
	{
		mediaJson = "[]";
		error = null;

		if (media is null || media.Count == 0)
		{
			return true;
		}

		if (media.Count > maxItems)
		{
			error = $"A maximum of {maxItems} media item(s) is allowed.";
			return false;
		}

		var normalized = new List<ForumMediaItem>(media.Count);
		var videoCount = 0;
		foreach (var item in media)
		{
			var kind = item.Kind?.Trim().ToLowerInvariant() ?? string.Empty;
			var url = item.Url?.Trim() ?? string.Empty;
			var contentType = item.ContentType?.Trim().ToLowerInvariant() ?? string.Empty;

			if (!AllowedKinds.Contains(kind))
			{
				error = "Media kind must be image or video.";
				return false;
			}

			if (kind == "video")
			{
				if (!allowVideo)
				{
					error = "Videos are not allowed here.";
					return false;
				}

				videoCount += 1;
			}

			if (videoCount > maxVideos)
			{
				error = $"A maximum of {maxVideos} video item(s) is allowed.";
				return false;
			}

			if (string.IsNullOrWhiteSpace(url) || url.Length > 1200)
			{
				error = "Media url is required and must be 1200 characters or fewer.";
				return false;
			}

			if (!Uri.TryCreate(url, UriKind.RelativeOrAbsolute, out _))
			{
				error = "Media url is invalid.";
				return false;
			}

			if (kind == "image" && contentType.Length > 0 && !contentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
			{
				error = "Image media must use an image content type.";
				return false;
			}

			if (kind == "video" && contentType.Length > 0 && !contentType.StartsWith("video/", StringComparison.OrdinalIgnoreCase))
			{
				error = "Video media must use a video content type.";
				return false;
			}

			normalized.Add(new ForumMediaItem(
				kind,
				url,
				TrimToNull(item.Key),
				TrimToNull(item.Name),
				TrimToNull(item.ContentType),
				item.SizeBytes is > 0 ? item.SizeBytes : null));
		}

		mediaJson = JsonSerializer.Serialize(normalized, JsonOptions);
		return true;
	}

	private static string? TrimToNull(string? value)
	{
		var trimmed = value?.Trim();
		return string.IsNullOrWhiteSpace(trimmed) ? null : trimmed;
	}
}

public sealed record ForumMediaInput(
	string Kind,
	string Url,
	string? Key,
	string? Name,
	string? ContentType,
	long? SizeBytes);

internal sealed record ForumMediaItem(
	string Kind,
	string Url,
	string? Key,
	string? Name,
	string? ContentType,
	long? SizeBytes);
