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
    string EventDataJson,
    IReadOnlyList<Guid>? ContactProfileIds = null,
    string? RamDataJson = null,
    // Accepted temporarily so older clients do not fail deserialization. New events are
    // always composed from facts and this legacy fixed-workflow value is ignored.
    string? WorkflowTemplateCode = null,
    bool AiAssistanceReviewed = false) : IRequest<AppResult<GroupEventSummaryDto>>;
