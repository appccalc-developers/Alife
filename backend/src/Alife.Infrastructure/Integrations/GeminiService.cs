using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Reflection;
using Alife.Application.Abstractions.Integrations;
using Alife.Application.Events.Dtos;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Alife.Infrastructure.Integrations;

/// <summary>
/// Calls the Gemini REST API to extract a structured <see cref="EventDto"/> from natural-language input.
/// Uses a system instruction that embeds the full OpenAPI-style schema so Gemini returns 100 % valid JSON.
/// </summary>
public sealed class GeminiService(
    IHttpClientFactory httpClientFactory,
    IConfiguration configuration,
    ILogger<GeminiService> logger) : IGeminiService
{
  private const string ResultPrefix = "RESULT:";

  // Gemini system instruction loaded from embedded text resource
  private static readonly string SystemInstruction = LoadSystemInstruction();

  private static string LoadSystemInstruction()
  {
    const string resourceName = "Alife.Infrastructure.Integrations.Prompts.GeminiSystemInstruction.md";

    var assembly = Assembly.GetExecutingAssembly();
    using var stream = assembly.GetManifestResourceStream(resourceName);
    if (stream is null)
    {
      throw new InvalidOperationException($"Embedded resource '{resourceName}' was not found.");
    }

    using var reader = new StreamReader(stream);
    return reader.ReadToEnd();
  }
    public async Task<ExtractEventFromChatResponseDto?> ExtractEventAsync(string userMessage, CancellationToken cancellationToken = default)
  {
    var apiKey = configuration["GEMINI_API_KEY"];
    if (string.IsNullOrWhiteSpace(apiKey))
    {
      logger.LogWarning("GEMINI_API_KEY is not configured. Returning null.");
      return null;
    }

    var systemText = SystemInstruction.Replace(
        "{{CURRENT_DATE}}",
        DateTime.UtcNow.ToString("yyyy-MM-dd"));

    var requestBody = new GeminiRequest
    {
      SystemInstruction = new GeminiContent
      {
        Parts = [new GeminiPart { Text = systemText }]
      },
      Contents =
        [
            new GeminiContent
                {
                    Role = "user",
                    Parts = [new GeminiPart { Text = userMessage }]
                }
        ],
      GenerationConfig = new GeminiGenerationConfig
      {
        ResponseMimeType = "text/plain",
        Temperature = 0.2,
        MaxOutputTokens = 2048
      }
    };

    var client = httpClientFactory.CreateClient("gemini");
    var url = "v1beta/models/gemini-flash-latest:generateContent";

    HttpResponseMessage response;
    try
    {
      using var httpRequest = new HttpRequestMessage(HttpMethod.Post, url);
      httpRequest.Headers.Add("X-goog-api-key", apiKey);
      httpRequest.Content = JsonContent.Create(requestBody);
      response = await client.SendAsync(httpRequest, cancellationToken);
    }
    catch (Exception ex)
    {
      logger.LogError(ex, "HTTP error calling Gemini API.");
      return null;
    }

    if (!response.IsSuccessStatusCode)
    {
      var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
      logger.LogWarning("Gemini API returned {StatusCode}. Body: {Body}", (int)response.StatusCode, errorBody);
      return null;
    }

    var responseText = await response.Content.ReadAsStringAsync(cancellationToken);

    GeminiResponse? geminiResponse;
    try
    {
      geminiResponse = JsonSerializer.Deserialize<GeminiResponse>(responseText);
    }
    catch (Exception ex)
    {
      logger.LogError(ex, "Failed to deserialize Gemini API response. Body: {Body}", responseText);
      return null;
    }

    var modelText = geminiResponse?.Candidates?.FirstOrDefault()
        ?.Content?.Parts?.FirstOrDefault()
        ?.Text;

    if (string.IsNullOrWhiteSpace(modelText))
    {
      logger.LogWarning("Gemini returned an empty response.");
      return null;
    }

    if (!modelText.TrimStart().StartsWith(ResultPrefix, StringComparison.OrdinalIgnoreCase))
    {
      return new ExtractEventFromChatResponseDto
      {
        ResponseMode = "markdown",
        Markdown = modelText,
        Result = null
      };
    }

    var prefixedBody = modelText.TrimStart();
    var jsonText = prefixedBody.Substring(ResultPrefix.Length).Trim();
    jsonText = StripJsonCodeFence(jsonText);

    try
    {
      var options = new JsonSerializerOptions
      {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
      };
      var dto = JsonSerializer.Deserialize<EventDto>(jsonText, options);
      if (dto is null)
      {
        logger.LogWarning("Gemini returned RESULT prefix but empty JSON payload.");
        return null;
      }

      return new ExtractEventFromChatResponseDto
      {
        ResponseMode = "result",
        Markdown = null,
        Result = dto
      };
    }
    catch (JsonException ex)
    {
      logger.LogError(ex, "Gemini returned invalid JSON: {Json}", jsonText);
      return null;
    }
  }

  // -----------------------------------------------------------------------
  // Private Gemini REST API models
  // -----------------------------------------------------------------------

  private sealed class GeminiRequest
  {
    [JsonPropertyName("system_instruction")]
    public GeminiContent? SystemInstruction { get; set; }

    [JsonPropertyName("contents")]
    public List<GeminiContent> Contents { get; set; } = [];

    [JsonPropertyName("generationConfig")]
    public GeminiGenerationConfig? GenerationConfig { get; set; }
  }

  private sealed class GeminiContent
  {
    [JsonPropertyName("role")]
    public string? Role { get; set; }

    [JsonPropertyName("parts")]
    public List<GeminiPart> Parts { get; set; } = [];
  }

  private sealed class GeminiPart
  {
    [JsonPropertyName("text")]
    public string Text { get; set; } = string.Empty;
  }

  private sealed class GeminiGenerationConfig
  {
    [JsonPropertyName("responseMimeType")]
    public string ResponseMimeType { get; set; } = "application/json";

    [JsonPropertyName("temperature")]
    public double Temperature { get; set; } = 0.2;

    [JsonPropertyName("maxOutputTokens")]
    public int MaxOutputTokens { get; set; } = 2048;
  }

  private sealed class GeminiResponse
  {
    [JsonPropertyName("candidates")]
    public List<GeminiCandidate>? Candidates { get; set; }
  }

  private sealed class GeminiCandidate
  {
    [JsonPropertyName("content")]
    public GeminiContent? Content { get; set; }
  }

  private static string StripJsonCodeFence(string payload)
  {
    if (!payload.StartsWith("```", StringComparison.Ordinal))
    {
      return payload;
    }

    var normalized = payload.Trim();
    if (normalized.StartsWith("```json", StringComparison.OrdinalIgnoreCase))
    {
      normalized = normalized.Substring(7).TrimStart();
    }
    else if (normalized.StartsWith("```", StringComparison.Ordinal))
    {
      normalized = normalized.Substring(3).TrimStart();
    }

    if (normalized.EndsWith("```", StringComparison.Ordinal))
    {
      normalized = normalized.Substring(0, normalized.Length - 3).TrimEnd();
    }

    return normalized;
  }
}
