namespace Alife.Application.VisitContactRequests.Dtos;

public sealed record VisitContactRequestDto(
    Guid Id,
    string DisplayName,
    string? Salutation,
    string? Email,
    string? Phone,
    string? PreferredLanguage,
    string? Message,
    string? SourcePage,
    string Status,
    DateTime SubmittedUtc,
    DateTime? HandledUtc,
    Guid? HandledByMemberId,
    string? HandledByDisplayName,
    DateTime CreatedUtc,
    DateTime UpdatedUtc);
