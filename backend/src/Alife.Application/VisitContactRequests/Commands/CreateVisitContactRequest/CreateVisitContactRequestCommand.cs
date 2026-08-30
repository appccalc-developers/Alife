using Alife.Application.Common.Models;
using Alife.Application.VisitContactRequests.Dtos;
using MediatR;

namespace Alife.Application.VisitContactRequests.Commands.CreateVisitContactRequest;

public sealed record CreateVisitContactRequestCommand(
    string DisplayName,
    string? Salutation,
    string? Email,
    string? Phone,
    string? PreferredLanguage,
    string? Message,
    string? SourcePage,
    string? IpAddress,
    string? UserAgent,
    string RequestKind = "visitorMessage",
    string? ReplyPreference = null,
    bool PrivacyConsent = false,
    string? PrivacyConsentVersion = null,
    string? Honeypot = null,
    long FormStartedUnixMilliseconds = 0) : IRequest<AppResult<VisitContactRequestDto>>;
