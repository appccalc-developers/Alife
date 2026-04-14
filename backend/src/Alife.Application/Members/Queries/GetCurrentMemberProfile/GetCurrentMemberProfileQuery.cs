using Alife.Application.Common.Models;
using Alife.Application.Members.Dtos;
using MediatR;

namespace Alife.Application.Members.Queries.GetCurrentMemberProfile;

public sealed record GetCurrentMemberProfileQuery(Guid CurrentMemberId) : IRequest<AppResult<CurrentMemberDto>>;
