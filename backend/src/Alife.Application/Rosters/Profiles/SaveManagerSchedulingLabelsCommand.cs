using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Rosters.Profiles;

public sealed record SaveManagerSchedulingLabelsCommand(
    Guid GroupId, Guid TargetMemberId, Guid CurrentMemberId,
    IReadOnlyList<string>? ManagerLabels, string? ManagerNotes,
    IReadOnlyList<SchedulingUnavailableWindowDto>? UnavailableWindows = null,
    string ConfirmationStatus = "confirmed",
    string ConfirmationMethod = "inPerson",
    DateTime? ReviewDueUtc = null,
    IReadOnlyList<ManagerQualificationDto>? Qualifications = null) : IRequest<AppResult<RosterMemberDto>>;
