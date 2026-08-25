using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Rosters.Profiles;

public sealed record SaveSelfSchedulingProfileCommand(
    Guid GroupId,
    Guid CurrentMemberId,
    IReadOnlyList<string>? PreferredRoleKeys,
    IReadOnlyList<SchedulingUnavailableWindowDto>? UnavailableWindows,
    int MaxAssignmentsPerDay,
    string? SelfNotes) : IRequest<AppResult<SelfSchedulingProfileDto>>;
