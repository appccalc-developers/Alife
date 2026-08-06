using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using MediatR;

namespace Alife.Application.Events.Queries.ListEventWorkflowTemplates;

public sealed record ListEventWorkflowTemplatesQuery : IRequest<AppResult<IReadOnlyList<EventWorkflowTemplateDto>>>;
