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
    IReadOnlyList<Guid>? ContactProfileIds = null,
    string? RamDataJson = null,
    bool PreserveFinanceConfirmation = false,
    bool AiAssistanceReviewed = false) : IRequest<AppResult<GroupEventSummaryDto>>;
