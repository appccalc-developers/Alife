using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using MediatR;

namespace Alife.Application.Events.Commands.ReconcileEventFinance;

public sealed record ReconcileEventFinanceCommand(
    Guid EventId,
    Guid CurrentMemberId,
    string NotesEn,
    string NotesZh,
    bool LeaderConfirmed) : IRequest<AppResult<EventFinanceReconciliationDto>>;
