using Alife.Application.Common.Models;
using System.Text.Json;

namespace Alife.Application.Forum.Services;

public static class ForumTextPayload
{
	private static readonly string[] SupportedLanguages = ["en", "zh"];

	public static bool TryNormalize(
		IReadOnlyDictionary<string, string>? value,
		string fieldName,
		out string json,
		out AppResult<bool>? error)
	{
		json = "{}";
		error = null;

		if (value is null)
		{
			error = AppResult<bool>.Validation($"{fieldName} must include at least English or Chinese content.");
			return false;
		}

		var normalized = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
		foreach (var language in SupportedLanguages)
		{
			if (!value.TryGetValue(language, out var text))
			{
				continue;
			}

			var trimmed = text.Trim();
			if (!string.IsNullOrWhiteSpace(trimmed))
			{
				normalized[language] = trimmed;
			}
		}

		if (normalized.Count == 0)
		{
			error = AppResult<bool>.Validation($"{fieldName} must include at least English or Chinese content.");
			return false;
		}

		json = JsonSerializer.Serialize(normalized);
		return true;
	}

	public static string NormalizeOptional(IReadOnlyDictionary<string, string>? value)
	{
		if (value is null)
		{
			return "{}";
		}

		var normalized = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
		foreach (var language in SupportedLanguages)
		{
			if (!value.TryGetValue(language, out var text))
			{
				continue;
			}

			var trimmed = text.Trim();
			if (!string.IsNullOrWhiteSpace(trimmed))
			{
				normalized[language] = trimmed;
			}
		}

		return normalized.Count == 0 ? "{}" : JsonSerializer.Serialize(normalized);
	}
}
