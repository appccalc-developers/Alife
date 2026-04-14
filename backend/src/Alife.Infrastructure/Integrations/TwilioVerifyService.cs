using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Alife.Application.Abstractions.Integrations;
using Alife.Application.Common.Models;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Alife.Infrastructure.Integrations;

public class TwilioVerifyService : ITwilioVerifyService
{
	private static readonly Regex E164Regex = new("^\\+[1-9]\\d{7,14}$", RegexOptions.Compiled);

	private readonly HttpClient httpClient;
	private readonly TwilioVerifyOptions options;
	private readonly ILogger<TwilioVerifyService> logger;

	public TwilioVerifyService(
		HttpClient httpClient,
		IOptions<TwilioVerifyOptions> options,
		ILogger<TwilioVerifyService> logger)
	{
		this.httpClient = httpClient;
		this.options = options.Value;
		this.logger = logger;

		this.httpClient.BaseAddress ??= new Uri("https://verify.twilio.com");

		var credentials = Convert.ToBase64String(Encoding.ASCII.GetBytes($"{this.options.AccountSid}:{this.options.AuthToken}"));
		this.httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", credentials);
	}

	public Task<AppResult<bool>> StartVerificationAsync(string phoneE164, CancellationToken cancellationToken = default)
	{
		if (!IsValidE164(phoneE164))
		{
			return Task.FromResult(AppResult<bool>.Validation("Phone number must be in E.164 format."));
		}

		var path = $"/v2/Services/{Uri.EscapeDataString(options.VerifyServiceSid)}/Verifications";
		var payload = new Dictionary<string, string>
		{
			["To"] = phoneE164,
			["Channel"] = options.Channel
		};

		return PostToTwilioAsync(
			path,
			payload,
			successPredicate: status => string.Equals(status, "pending", StringComparison.OrdinalIgnoreCase)
				|| string.Equals(status, "approved", StringComparison.OrdinalIgnoreCase),
			validationFailureMessage: "Unable to start verification.",
			cancellationToken: cancellationToken);
	}

	public Task<AppResult<bool>> ConfirmCodeAsync(string phoneE164, string code, CancellationToken cancellationToken = default)
	{
		if (!IsValidE164(phoneE164))
		{
			return Task.FromResult(AppResult<bool>.Validation("Phone number must be in E.164 format."));
		}

		if (string.IsNullOrWhiteSpace(code))
		{
			return Task.FromResult(AppResult<bool>.Validation("Verification code is required."));
		}

		var path = $"/v2/Services/{Uri.EscapeDataString(options.VerifyServiceSid)}/VerificationCheck";
		var payload = new Dictionary<string, string>
		{
			["To"] = phoneE164,
			["Code"] = code
		};

		return PostToTwilioAsync(
			path,
			payload,
			successPredicate: status => string.Equals(status, "approved", StringComparison.OrdinalIgnoreCase),
			validationFailureMessage: "Invalid code.",
			cancellationToken: cancellationToken);
	}

	private async Task<AppResult<bool>> PostToTwilioAsync(
		string path,
		IDictionary<string, string> payload,
		Func<string?, bool> successPredicate,
		string validationFailureMessage,
		CancellationToken cancellationToken)
	{
		try
		{
			using var response = await httpClient.PostAsync(path, new FormUrlEncodedContent(payload), cancellationToken);
			var content = await response.Content.ReadAsStringAsync(cancellationToken);

			if (response.IsSuccessStatusCode)
			{
				var status = ReadStatus(content);
				return successPredicate(status)
					? AppResult<bool>.Success(true)
					: AppResult<bool>.Validation(validationFailureMessage);
			}

			return MapError(response.StatusCode, content, validationFailureMessage);
		}
		catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
		{
			logger.LogWarning("Twilio verify request timed out.");
			return AppResult<bool>.Validation("Verification service timed out. Please try again.");
		}
		catch (HttpRequestException ex)
		{
			logger.LogWarning(ex, "Twilio verify request failed due to a network error.");
			return AppResult<bool>.Validation("Verification service is temporarily unavailable. Please try again.");
		}
	}

	private AppResult<bool> MapError(HttpStatusCode statusCode, string content, string fallbackValidationMessage)
	{
		var twilioError = ReadTwilioError(content);
		var statusCodeNumber = (int)statusCode;

		if (statusCode == HttpStatusCode.Unauthorized || statusCode == HttpStatusCode.Forbidden)
		{
			logger.LogError(
				"Twilio verify authorization failed with status {StatusCode}. TwilioCode={TwilioCode}",
				statusCodeNumber,
				twilioError.Code);
			return AppResult<bool>.Forbidden("Verification provider credentials are invalid.");
		}

		if (statusCode == HttpStatusCode.NotFound)
		{
			logger.LogError(
				"Twilio verify service SID was not found. Status {StatusCode}. TwilioCode={TwilioCode}",
				statusCodeNumber,
				twilioError.Code);
			return AppResult<bool>.NotFound("Verification provider is not configured correctly.");
		}

		if (statusCode == HttpStatusCode.TooManyRequests)
		{
			return AppResult<bool>.Validation("Too many verification attempts. Please wait and retry.");
		}

		if (statusCodeNumber >= 500)
		{
			logger.LogWarning(
				"Twilio verify server error {StatusCode}. TwilioCode={TwilioCode}",
				statusCodeNumber,
				twilioError.Code);
			return AppResult<bool>.Validation("Verification service is temporarily unavailable. Please try again.");
		}

		if (!string.IsNullOrWhiteSpace(twilioError.Message))
		{
			return AppResult<bool>.Validation(twilioError.Message);
		}

		return AppResult<bool>.Validation(fallbackValidationMessage);
	}

	private static bool IsValidE164(string phoneE164)
		=> !string.IsNullOrWhiteSpace(phoneE164) && E164Regex.IsMatch(phoneE164.Trim());

	private static string? ReadStatus(string content)
	{
		try
		{
			using var json = JsonDocument.Parse(content);
			return json.RootElement.TryGetProperty("status", out var statusElement)
				? statusElement.GetString()
				: null;
		}
		catch (JsonException)
		{
			return null;
		}
	}

	private static (int? Code, string? Message) ReadTwilioError(string content)
	{
		try
		{
			using var json = JsonDocument.Parse(content);
			int? code = null;
			if (json.RootElement.TryGetProperty("code", out var codeElement)
				&& codeElement.ValueKind == JsonValueKind.Number
				&& codeElement.TryGetInt32(out var codeValue))
			{
				code = codeValue;
			}

			var message = json.RootElement.TryGetProperty("message", out var messageElement)
				? messageElement.GetString()
				: null;

			return (code, message);
		}
		catch (JsonException)
		{
			return (null, null);
		}
	}
}
