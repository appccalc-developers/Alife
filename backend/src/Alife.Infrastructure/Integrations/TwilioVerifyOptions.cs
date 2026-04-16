namespace Alife.Infrastructure.Integrations;

public sealed class TwilioVerifyOptions
{
	public const string SectionName = "Twilio";

	private static readonly string[] SupportedChannels = ["sms", "whatsapp", "call"];

	public string AccountSid { get; set; } = string.Empty;
	public string VerifyServiceSid { get; set; } = string.Empty;
	public string AuthToken { get; set; } = string.Empty;
	public string Channel { get; set; } = "sms";

	/// <summary>
	/// Set to "1" or "true" to bypass Twilio verification entirely (development/test use only).
	/// When enabled, any phone number and code will be accepted as valid.
	/// </summary>
	public string? Skip { get; set; }

	public bool IsSkipEnabled => ParseSkip(Skip);

	public static bool ParseSkip(string? value) =>
		value == "1" || string.Equals(value, "true", StringComparison.OrdinalIgnoreCase);

	public static bool IsValidChannel(string? channel)
		=> !string.IsNullOrWhiteSpace(channel)
			&& SupportedChannels.Contains(channel.Trim(), StringComparer.OrdinalIgnoreCase);
}
