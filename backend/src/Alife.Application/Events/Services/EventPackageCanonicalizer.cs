using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Alife.Application.Events.Services;

public static class EventPackageCanonicalizer
{
    private static readonly JsonSerializerOptions JsonOptions = EventCompositionEngine.CreateJsonOptions();

    public static string Serialize(object value)
    {
        using var source = JsonDocument.Parse(JsonSerializer.SerializeToUtf8Bytes(value, JsonOptions));
        using var stream = new MemoryStream();
        using (var writer = new Utf8JsonWriter(stream, new JsonWriterOptions { Indented = false }))
        {
            WriteCanonical(writer, source.RootElement);
        }
        return System.Text.Encoding.UTF8.GetString(stream.ToArray());
    }

    public static string HashCanonical(object value)
        => Convert.ToHexStringLower(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(Serialize(value))));

    public static string GovernanceEventDataProjection(string json)
    {
        var node = JsonNode.Parse(json);
        if (node is JsonObject root)
        {
            var cosmeticFields = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "title", "description", "posterImageUrl", "galleryUrls", "legacySummary"
            };
            foreach (var propertyName in root.Select(x => x.Key).Where(cosmeticFields.Contains).ToArray())
                root.Remove(propertyName);
        }
        return node?.ToJsonString() ?? "null";
    }

    public static string HashGovernanceEventData(string json)
    {
        using var document = JsonDocument.Parse(GovernanceEventDataProjection(json));
        return HashCanonical(document.RootElement);
    }

    private static void WriteCanonical(Utf8JsonWriter writer, JsonElement element)
    {
        switch (element.ValueKind)
        {
            case JsonValueKind.Object:
                writer.WriteStartObject();
                foreach (var property in element.EnumerateObject().OrderBy(x => x.Name, StringComparer.Ordinal))
                {
                    writer.WritePropertyName(property.Name);
                    WriteCanonical(writer, property.Value);
                }
                writer.WriteEndObject();
                break;
            case JsonValueKind.Array:
                writer.WriteStartArray();
                foreach (var item in element.EnumerateArray()) WriteCanonical(writer, item);
                writer.WriteEndArray();
                break;
            case JsonValueKind.String:
                writer.WriteStringValue(element.GetString());
                break;
            case JsonValueKind.Number:
                writer.WriteRawValue(element.GetRawText(), skipInputValidation: true);
                break;
            case JsonValueKind.True:
                writer.WriteBooleanValue(true);
                break;
            case JsonValueKind.False:
                writer.WriteBooleanValue(false);
                break;
            case JsonValueKind.Null:
                writer.WriteNullValue();
                break;
            default:
                throw new JsonException($"Unsupported canonical JSON token {element.ValueKind}.");
        }
    }
}
