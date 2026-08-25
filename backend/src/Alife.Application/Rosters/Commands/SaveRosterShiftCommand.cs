using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Rosters.Commands;

public sealed record SaveRosterShiftCommand(
    Guid EventId, Guid? ShiftId, Guid CurrentMemberId,
    string RoleKey, string NameEn, string NameZh,
    DateTime StartUtc, DateTime EndUtc, int RequiredPeople,
    IReadOnlyList<string>? RequiredLabels, string? Notes) : IRequest<AppResult<RosterShiftDto>>;
