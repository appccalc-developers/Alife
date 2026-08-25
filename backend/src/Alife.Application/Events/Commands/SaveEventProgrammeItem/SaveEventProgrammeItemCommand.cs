using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Domain.Enums;
using MediatR;

namespace Alife.Application.Events.Commands.SaveEventProgrammeItem;

public sealed record SaveEventProgrammeItemCommand(
    Guid EventId,
    Guid? ItemId,
    Guid CurrentMemberId,
    Guid? EventOccurrenceId,
    Guid? RosterShiftId,
    Guid? OwnerMemberId,
    int SortOrder,
    DateTime StartUtc,
    DateTime EndUtc,
    string TitleEn,
    string TitleZh,
    string InstructionsEn,
    string InstructionsZh,
    bool RequiresHandover,
    string HandoverEn,
    string HandoverZh,
    EventProgrammeItemStatus Status) : IRequest<AppResult<EventProgrammeItemDto>>;
