using Alife.Application.Common.Models;
using Alife.Application.Contacts.Dtos;
using MediatR;

namespace Alife.Application.Contacts.Queries.GetGroupContactProfiles;

public sealed record GetGroupContactProfilesQuery(Guid GroupId, Guid? CurrentMemberId)
    : IRequest<AppResult<IReadOnlyList<ContactProfileDto>>>;
