using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using MediatR;

namespace Alife.Application.Events.Queries.ListEventWorkflowTemplates;

public sealed record ListEventWorkflowTemplatesQuery(Guid? GroupId, Guid CurrentMemberId)
    : IRequest<AppResult<IReadOnlyList<EventWorkflowTemplateDto>>>;
