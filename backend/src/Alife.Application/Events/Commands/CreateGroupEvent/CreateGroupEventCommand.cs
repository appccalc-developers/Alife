using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using MediatR;

namespace Alife.Application.Events.Commands.CreateGroupEvent;

public sealed record CreateGroupEventCommand(
    Guid GroupId,
    Guid CurrentMemberId,
    string TitleEn,
    string TitleZh,
    DateTime StartDate,
    DateTime EndDate,
    string EventDataJson) : IRequest<AppResult<GroupEventSummaryDto>>;
