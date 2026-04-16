using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Alife.Application.Abstractions.Integrations;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Alife.Infrastructure.Integrations;

public class LineLoginService(
	HttpClient httpClient,
	IConfiguration configuration,
	ILogger<LineLoginService> logger) : ILineLoginService
{
	private const string LineAuthorizeUrl = "https://access.line.me/oauth2/v2.1/authorize";
	private const string LineTokenUrl = "https://api.line.me/oauth2/v2.1/token";

	public string GetAuthorizationUrl(string state)
	{
		var clientId = configuration["LineLogin:ClientId"] ?? string.Empty;
		var redirectUri = configuration["LineLogin:RedirectUri"] ?? string.Empty;

		var query = System.Web.HttpUtility.ParseQueryString(string.Empty);
		query["response_type"] = "code";
		query["client_id"] = clientId;
		query["redirect_uri"] = redirectUri;
		query["state"] = state;
		query["scope"] = "profile openid email";

		return $"{LineAuthorizeUrl}?{query}";
	}

	public async Task<LineTokenResult?> ExchangeCodeAsync(string code, CancellationToken cancellationToken = default)
	{
		var clientId = configuration["LineLogin:ClientId"] ?? string.Empty;
		var clientSecret = configuration["LineLogin:ClientSecret"] ?? string.Empty;
		var redirectUri = configuration["LineLogin:RedirectUri"] ?? string.Empty;

		var formData = new Dictionary<string, string>
		{
			["grant_type"] = "authorization_code",
			["code"] = code,
			["redirect_uri"] = redirectUri,
			["client_id"] = clientId,
			["client_secret"] = clientSecret
		};

		using var request = new HttpRequestMessage(HttpMethod.Post, LineTokenUrl)
		{
			Content = new FormUrlEncodedContent(formData)
		};

		using var response = await httpClient.SendAsync(request, cancellationToken);
		if (!response.IsSuccessStatusCode)
		{
			logger.LogWarning("LINE token exchange failed with status {StatusCode}", response.StatusCode);
			return null;
		}

		var tokenResponse = await response.Content.ReadFromJsonAsync<LineTokenResponse>(cancellationToken: cancellationToken);
		if (tokenResponse?.IdToken is null)
		{
			logger.LogWarning("LINE token exchange response did not include an id_token");
			return null;
		}

		return ParseIdToken(tokenResponse.IdToken);
	}

	private LineTokenResult? ParseIdToken(string idToken)
	{
		try
		{
			var handler = new JwtSecurityTokenHandler();
			if (!handler.CanReadToken(idToken))
			{
				logger.LogWarning("LINE id_token could not be read as a JWT");
				return null;
			}

			var jwt = handler.ReadJwtToken(idToken);
			var lineUID = jwt.Subject;
			if (string.IsNullOrWhiteSpace(lineUID))
			{
				logger.LogWarning("LINE id_token is missing the 'sub' claim");
				return null;
			}

			var displayName = jwt.Claims.FirstOrDefault(c => c.Type == "name")?.Value;
			var email = jwt.Claims.FirstOrDefault(c => c.Type == "email")?.Value;

			return new LineTokenResult(lineUID, displayName, email);
		}
		catch (Exception ex)
		{
			logger.LogError(ex, "Failed to parse LINE id_token");
			return null;
		}
	}

	private sealed record LineTokenResponse(
		[property: JsonPropertyName("access_token")] string? AccessToken,
		[property: JsonPropertyName("id_token")] string? IdToken,
		[property: JsonPropertyName("token_type")] string? TokenType,
		[property: JsonPropertyName("expires_in")] int? ExpiresIn,
		[property: JsonPropertyName("refresh_token")] string? RefreshToken,
		[property: JsonPropertyName("scope")] string? Scope);
}
