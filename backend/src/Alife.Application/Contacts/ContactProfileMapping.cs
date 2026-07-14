using System.Text.Json;
using Alife.Application.Contacts.Dtos;
using Alife.Domain.Entities;
using Alife.Domain.Enums;

namespace Alife.Application.Contacts;

internal static class ContactProfileMapping
{
    public static ContactProfileDto ToDto(ContactProfile profile) => new(
        profile.Id,
        profile.MemberId,
        profile.OwnerGroupId,
        Deserialize(profile.NameJson),
        Deserialize(profile.RoleJson),
        profile.PhotoUrl,
        string.IsNullOrWhiteSpace(profile.NotesJson) ? null : Deserialize(profile.NotesJson),
        profile.Phone,
        profile.Email,
        profile.Visibility == ContactProfileVisibility.Public ? "public" : "groupOnly",
        profile.CreatedUtc,
        profile.UpdatedUtc);

    public static string Serialize(IReadOnlyDictionary<string, string>? value)
        => JsonSerializer.Serialize(value ?? new Dictionary<string, string>());

    public static Dictionary<string, string> NormalizeLocalized(IReadOnlyDictionary<string, string>? value)
    {
        var normalized = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var entry in value ?? new Dictionary<string, string>())
        {
            if (!string.IsNullOrWhiteSpace(entry.Key) && !string.IsNullOrWhiteSpace(entry.Value))
            {
                normalized[entry.Key.Trim().ToLowerInvariant()] = entry.Value.Trim();
            }
        }
        return normalized;
    }

    private static IReadOnlyDictionary<string, string> Deserialize(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, string>>(json) ?? new Dictionary<string, string>();
        }
        catch (JsonException)
        {
            return new Dictionary<string, string>();
        }
    }
}
