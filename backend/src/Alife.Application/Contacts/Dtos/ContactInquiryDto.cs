namespace Alife.Application.Contacts.Dtos;

public sealed record ContactInquiryDto(
    Guid Id,
    Guid ContactProfileId,
    Guid OwnerGroupId,
    Guid? SubmittedByMemberId,
    string DisplayName,
    string? Email,
    string? Phone,
    string Message,
    string? PreferredLanguage,
    DateTime SubmittedUtc);
