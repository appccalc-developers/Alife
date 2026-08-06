using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using MediatR;

namespace Alife.Application.Events.Commands.InitializeEventWorkflow;

public sealed record InitializeEventWorkflowCommand(Guid EventId, Guid CurrentMemberId, string TemplateCode)
    : IRequest<AppResult<EventWorkflowDto>>;
