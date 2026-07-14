namespace Alife.Application.Contacts.Dtos;

public sealed record ContactProfileDto(
    Guid Id,
    Guid MemberId,
    Guid OwnerGroupId,
    IReadOnlyDictionary<string, string> Name,
    IReadOnlyDictionary<string, string> Role,
    string? PhotoUrl,
    IReadOnlyDictionary<string, string>? Notes,
    string? Phone,
    string? Email,
    string Visibility,
    DateTime CreatedUtc,
    DateTime UpdatedUtc);
