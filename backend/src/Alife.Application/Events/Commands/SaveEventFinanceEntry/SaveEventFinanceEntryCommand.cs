using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Domain.Enums;
using MediatR;

namespace Alife.Application.Events.Commands.SaveEventFinanceEntry;

public sealed record SaveEventFinanceEntryCommand(
    Guid EventId,
    Guid? EntryId,
    Guid CurrentMemberId,
    EventFinanceEntryType Type,
    string Category,
    string DescriptionEn,
    string DescriptionZh,
    decimal Amount,
    DateTime OccurredUtc) : IRequest<AppResult<EventFinanceEntryDto>>;
