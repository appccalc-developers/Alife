using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Rosters.Profiles;

public sealed record GetSelfSchedulingProfileQuery(Guid GroupId, Guid CurrentMemberId)
    : IRequest<AppResult<SelfSchedulingProfileDto>>;
