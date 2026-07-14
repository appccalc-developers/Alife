using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using MediatR;

namespace Alife.Application.Events.Commands.UpdateGroupEvent;

public sealed record UpdateGroupEventCommand(
    Guid EventId,
    Guid CurrentMemberId,
    string TitleEn,
    string TitleZh,
    DateTime StartDate,
    DateTime EndDate,
    string EventDataJson,
    IReadOnlyList<Guid>? ContactProfileIds = null) : IRequest<AppResult<GroupEventSummaryDto>>;
