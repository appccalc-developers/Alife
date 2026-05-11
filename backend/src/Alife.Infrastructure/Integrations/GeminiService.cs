using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
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
    // -----------------------------------------------------------------------
    // Gemini system instruction — EventDto OpenAPI schema embedded inline
    // -----------------------------------------------------------------------
    private const string SystemInstruction = """
        You are an AI assistant for Alife, a bilingual (Chinese/English) church community app.
        Your sole task is to extract event details from a user's natural-language text or voice transcript
        and return a single, minified JSON object that strictly conforms to the EventDto schema below.

        === EventDto JSON Schema (OpenAPI 3.1 inline object schema) ===
        {
          "type": "object",
          "required": ["title", "description", "locationName", "startDate", "endDate", "registrationDeadline"],
          "properties": {
            "id":           { "type": "string", "format": "uuid", "description": "Leave empty string — server will assign." },
            "organizerId":  { "type": "string", "description": "Leave empty string — server will assign." },
            "title": {
              "type": "object",
              "required": ["zh", "en"],
              "properties": {
                "zh": { "type": "string", "description": "Event title in Simplified Chinese." },
                "en": { "type": "string", "description": "Event title in New-Zealand English." }
              }
            },
            "description": {
              "type": "object",
              "required": ["zh", "en"],
              "properties": {
                "zh": { "type": "string" },
                "en": { "type": "string" }
              }
            },
            "locationName": {
              "type": "object",
              "required": ["zh", "en"],
              "properties": {
                "zh": { "type": "string" },
                "en": { "type": "string" }
              }
            },
            "startDate":             { "type": "string", "format": "date-time", "description": "ISO-8601 UTC." },
            "endDate":               { "type": "string", "format": "date-time" },
            "registrationDeadline":  { "type": "string", "format": "date-time" },
            "maxCapacity":           { "type": "integer", "minimum": 1 },
            "capacityUnit":          { "type": "string", "enum": ["Families", "People"], "default": "Families" },
            "hardConstraints": {
              "type": "array",
              "items": {
                "type": "object",
                "required": ["ruleKey", "displayMessage", "isMandatory"],
                "properties": {
                  "ruleKey":        { "type": "string", "description": "E.g. Transport, Food, Safety, General." },
                  "displayMessage": {
                    "type": "object",
                    "properties": {
                      "zh": { "type": "string" },
                      "en": { "type": "string" }
                    }
                  },
                  "isMandatory": { "type": "boolean", "default": true }
                }
              }
            },
            "optionalActivities": {
              "type": "array",
              "items": {
                "type": "object",
                "required": ["name", "extraFee"],
                "properties": {
                  "id":       { "type": "string", "format": "uuid" },
                  "name":     { "type": "object", "properties": { "zh": { "type": "string" }, "en": { "type": "string" } } },
                  "extraFee": { "type": "number", "minimum": 0 }
                }
              }
            },
            "baseFeePerAdult":  { "type": ["number", "null"] },
            "baseFeePerChild":  { "type": ["number", "null"] },
            "currency":         { "type": "string", "default": "NZD" },
            "posterImageUrl":   { "type": ["string", "null"] },
            "galleryUrls":      { "type": "array", "items": { "type": "string" } },
            "legacySummary": {
              "type": ["object", "null"],
              "properties": {
                "zh": { "type": "string" },
                "en": { "type": "string" }
              }
            }
          }
        }
        === End Schema ===

        Rules:
        1. Output ONLY the raw JSON object — no markdown fences, no prose, no comments.
        2. All date-time fields MUST be ISO-8601 UTC strings (e.g. "2026-12-01T08:00:00Z").
        3. Every MultilingualString field MUST have both "zh" and "en" keys populated.
           If the user spoke only one language, translate the other field yourself.
        4. Extract hard constraints from phrases like "must take the bus", "no pork", "must RSVP".
           Map each to a ruleKey: Transport | Food | Safety | RSVP | General.
        5. If a value cannot be inferred, use a sensible default (e.g. maxCapacity: 20, currency: "NZD").
        6. Do NOT fabricate specific dates unless clearly stated; use the current year and a plausible month.
        7. The current reference date is: {{CURRENT_DATE}}.
        """;

    public async Task<EventDto?> ExtractEventAsync(string userMessage, CancellationToken cancellationToken = default)
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
                ResponseMimeType = "application/json",
                Temperature = 0.2,
                MaxOutputTokens = 2048
            }
        };

        var client = httpClientFactory.CreateClient("gemini");
        var url = $"v1beta/models/gemini-2.0-flash:generateContent?key={Uri.EscapeDataString(apiKey)}";

        HttpResponseMessage response;
        try
        {
            response = await client.PostAsJsonAsync(url, requestBody, cancellationToken);
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

        GeminiResponse? geminiResponse;
        try
        {
            geminiResponse = await response.Content.ReadFromJsonAsync<GeminiResponse>(cancellationToken: cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to deserialize Gemini API response.");
            return null;
        }

        var jsonText = geminiResponse?.Candidates?.FirstOrDefault()
            ?.Content?.Parts?.FirstOrDefault()
            ?.Text;

        if (string.IsNullOrWhiteSpace(jsonText))
        {
            logger.LogWarning("Gemini returned an empty response.");
            return null;
        }

        try
        {
            var options = new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true,
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            };
            return JsonSerializer.Deserialize<EventDto>(jsonText, options);
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
}
