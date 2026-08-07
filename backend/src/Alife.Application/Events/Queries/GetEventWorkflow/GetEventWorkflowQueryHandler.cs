using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Queries.GetEventWorkflow;

public sealed class GetEventWorkflowQueryHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService)
    : IRequestHandler<GetEventWorkflowQuery, AppResult<EventWorkflowDto?>>
{
    public async Task<AppResult<EventWorkflowDto?>> Handle(GetEventWorkflowQuery request, CancellationToken cancellationToken)
    {
        var groupId = await dbContext.GroupEvents.AsNoTracking()
            .Where(x => x.Id == request.EventId)
            .Select(x => (Guid?)x.GroupId)
            .FirstOrDefaultAsync(cancellationToken);
        if (groupId is null)
        {
            return AppResult<EventWorkflowDto?>.NotFound("Event not found.");
        }

        var isAdmin = await groupAuthorizationService.IsAdminAsync(request.CurrentMemberId, cancellationToken);
        var isManager = await groupAuthorizationService.IsLeaderOrCoLeaderAsync(
            groupId.Value, request.CurrentMemberId, cancellationToken);
        var canRead = isAdmin || isManager ||
            await groupAuthorizationService.IsApprovedMemberAsync(groupId.Value, request.CurrentMemberId, cancellationToken);
        if (!canRead)
        {
            return AppResult<EventWorkflowDto?>.Forbidden("Approved group membership is required to view event workflow documents.");
        }

        var run = await dbContext.EventWorkflowRuns
            .AsNoTracking()
            .Include(x => x.Template)
            .Include(x => x.Steps)
                .ThenInclude(x => x.Artifacts)
            .FirstOrDefaultAsync(x => x.EventId == request.EventId, cancellationToken);
        return AppResult<EventWorkflowDto?>.Success(
            run is null ? null : EventWorkflowDefinition.ToDto(run, includePrivateArtifacts: isAdmin || isManager));
    }
}
