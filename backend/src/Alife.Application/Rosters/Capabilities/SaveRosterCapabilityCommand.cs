using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Rosters.Capabilities;

public sealed record SaveRosterCapabilityCommand(
    Guid GroupId,
    Guid? CapabilityId,
    Guid CurrentMemberId,
    string Key,
    string NameEn,
    string NameZh,
    string DescriptionEn,
    string DescriptionZh,
    bool RequiresExpiry,
    int? DefaultValidityDays,
    bool IsActive) : IRequest<AppResult<RosterCapabilityDto>>;
