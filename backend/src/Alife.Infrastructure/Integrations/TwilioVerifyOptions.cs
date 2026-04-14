namespace Alife.Infrastructure.Integrations;

public sealed class TwilioVerifyOptions
{
	public const string SectionName = "Twilio";

	private static readonly string[] SupportedChannels = ["sms", "whatsapp", "call"];

	public string AccountSid { get; set; } = string.Empty;
	public string VerifyServiceSid { get; set; } = string.Empty;
	public string AuthToken { get; set; } = string.Empty;
	public string Channel { get; set; } = "sms";

	public static bool IsValidChannel(string? channel)
		=> !string.IsNullOrWhiteSpace(channel)
			&& SupportedChannels.Contains(channel.Trim(), StringComparer.OrdinalIgnoreCase);
}
