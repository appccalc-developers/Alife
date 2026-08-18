using System.Text.Json;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Queries.ListEventWorkflowTemplates;

public sealed class ListEventWorkflowTemplatesQueryHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService)
    : IRequestHandler<ListEventWorkflowTemplatesQuery, AppResult<IReadOnlyList<EventWorkflowTemplateDto>>>
{
    public async Task<AppResult<IReadOnlyList<EventWorkflowTemplateDto>>> Handle(
        ListEventWorkflowTemplatesQuery request,
        CancellationToken cancellationToken)
    {
        if (request.GroupId is { } groupId &&
            !await groupAuthorizationService.IsApprovedMemberAsync(groupId, request.CurrentMemberId, cancellationToken))
        {
            return AppResult<IReadOnlyList<EventWorkflowTemplateDto>>.Forbidden("Only approved group members can view its workflow templates.");
        }

        var templates = await dbContext.EventWorkflowTemplates
            .AsNoTracking()
            .Where(x => x.IsActive && (x.OwnerGroupId == null || x.OwnerGroupId == request.GroupId))
            .OrderBy(x => x.OwnerGroupId == null ? 0 : 1)
            .ThenBy(x => x.Code)
            .ThenByDescending(x => x.Version)
            .ToListAsync(cancellationToken);
        try
        {
            return AppResult<IReadOnlyList<EventWorkflowTemplateDto>>.Success(
                templates.GroupBy(x => x.Code).Select(x => EventWorkflowDefinition.ToDto(x.First())).ToArray());
        }
        catch (JsonException)
        {
            return AppResult<IReadOnlyList<EventWorkflowTemplateDto>>.Validation("An active workflow template is invalid.");
        }
    }
}
