using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using MediatR;

namespace Alife.Application.Events.Commands.CreateEventWorkflowTemplate;

public sealed record CreateEventWorkflowStageInput(
    string NameEn,
    string NameZh,
    bool RequiresApproval);

public sealed record CreateEventWorkflowTemplateCommand(
    Guid GroupId,
    Guid CurrentMemberId,
    string NameEn,
    string NameZh,
    string DescriptionEn,
    string DescriptionZh,
    IReadOnlyList<CreateEventWorkflowStageInput> Stages)
    : IRequest<AppResult<EventWorkflowTemplateDto>>;
