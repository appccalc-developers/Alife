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
    string? UserAgent) : IRequest<AppResult<VisitContactRequestDto>>;
