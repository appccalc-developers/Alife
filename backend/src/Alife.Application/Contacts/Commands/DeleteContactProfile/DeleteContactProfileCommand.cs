using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Contacts.Commands.DeleteContactProfile;

public sealed record DeleteContactProfileCommand(Guid ContactProfileId, Guid CurrentMemberId) : IRequest<AppResult<bool>>;
