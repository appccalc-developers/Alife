namespace Alife.Domain.Constants;

public static class MemberLanguage
{
	public const string Zh = "zh";
	public const string En = "en";

	public static string Normalize(string? value)
		=> TryNormalize(value) ?? Zh;

	public static string? TryNormalize(string? value)
		=> value?.Trim().ToLowerInvariant() switch
		{
			Zh => Zh,
			En => En,
			_ => null
		};
}