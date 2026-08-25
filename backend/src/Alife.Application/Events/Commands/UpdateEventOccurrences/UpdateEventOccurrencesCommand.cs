using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using MediatR;

namespace Alife.Application.Events.Commands.UpdateEventOccurrences;

public sealed record UpdateEventOccurrenceInput(
    Guid? Id,
    string NameEn,
    string NameZh,
    DateTime StartUtc,
    DateTime EndUtc,
    string TimeZoneId);

public sealed record UpdateEventOccurrencesCommand(
    Guid EventId,
    Guid CurrentMemberId,
    IReadOnlyList<UpdateEventOccurrenceInput> Occurrences)
    : IRequest<AppResult<IReadOnlyList<EventPlanOccurrenceDto>>>;
