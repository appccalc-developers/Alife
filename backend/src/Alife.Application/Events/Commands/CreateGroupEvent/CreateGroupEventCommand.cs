using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Domain.Enums;
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
    string? WorkflowTemplateCode = null,
    EventPlanComposeRequest? Composition = null,
    string? CompositionProposalHash = null,
    Guid? AccountableOwnerMemberId = null,
    EventGovernanceMode? GovernanceMode = null,
    Guid? ParentEventId = null,
    string? IdempotencyKey = null,
    CreateEventSeriesSetupRequest? SeriesSetup = null) : IRequest<AppResult<GroupEventSummaryDto>>;
