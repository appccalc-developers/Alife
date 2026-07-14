using Alife.Application.Common.Models;
using Alife.Application.Contacts.Dtos;
using MediatR;

namespace Alife.Application.Contacts.Commands.CreateContactInquiry;

public sealed record CreateContactInquiryCommand(
    Guid ContactProfileId,
    Guid? CurrentMemberId,
    string DisplayName,
    string? Email,
    string? Phone,
    string Message,
    string? PreferredLanguage,
    string? SourcePage,
    string? IpAddress,
    string? UserAgent) : IRequest<AppResult<ContactInquiryDto>>;
