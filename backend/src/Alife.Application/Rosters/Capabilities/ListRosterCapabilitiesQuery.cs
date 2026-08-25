using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Rosters.Capabilities;

public sealed record ListRosterCapabilitiesQuery(Guid GroupId, Guid CurrentMemberId)
    : IRequest<AppResult<IReadOnlyList<RosterCapabilityDto>>>;
