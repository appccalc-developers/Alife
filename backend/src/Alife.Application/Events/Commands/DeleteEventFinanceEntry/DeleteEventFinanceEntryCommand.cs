using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Events.Commands.DeleteEventFinanceEntry;

public sealed record DeleteEventFinanceEntryCommand(Guid EventId, Guid EntryId, Guid CurrentMemberId)
    : IRequest<AppResult<bool>>;
