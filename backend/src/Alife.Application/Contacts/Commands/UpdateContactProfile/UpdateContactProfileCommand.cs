using Alife.Application.Common.Models;
using Alife.Application.Contacts.Dtos;
using MediatR;

namespace Alife.Application.Contacts.Commands.UpdateContactProfile;

public sealed record UpdateContactProfileCommand(
    Guid ContactProfileId,
    Guid CurrentMemberId,
    Guid MemberId,
    IReadOnlyDictionary<string, string> Name,
    IReadOnlyDictionary<string, string> Role,
    string? PhotoUrl,
    IReadOnlyDictionary<string, string>? Notes,
    string? Phone,
    string? Email,
    string Visibility) : IRequest<AppResult<ContactProfileDto>>;
