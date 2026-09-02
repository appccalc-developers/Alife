using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Commands.SubmitEventRam;

public sealed class SubmitEventRamCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IEventCacheInvalidationService eventCacheInvalidationService,
    IEventPackageInvalidationService packageInvalidationService)
    : IRequestHandler<SubmitEventRamCommand, AppResult<EventRamAssessmentDto>>
{
    public async Task<AppResult<EventRamAssessmentDto>> Handle(SubmitEventRamCommand request, CancellationToken cancellationToken)
    {
        var groupEvent = await dbContext.GroupEvents
            .Include(x => x.RamAssessment)
            .FirstOrDefaultAsync(x => x.Id == request.EventId, cancellationToken);
        if (groupEvent?.RamAssessment is null)
        {
            return AppResult<EventRamAssessmentDto>.NotFound("RAM draft not found.");
        }

        if (!await groupAuthorizationService.IsLeaderOrCoLeaderAsync(groupEvent.GroupId, request.CurrentMemberId, cancellationToken))
        {
            return AppResult<EventRamAssessmentDto>.Forbidden("Only group leaders and co-leaders can request RAM review.");
        }

        var errors = EventRamPolicy.ValidateForReview(groupEvent.RamAssessment.RamDataJson);
        if (errors.Count > 0)
        {
            return AppResult<EventRamAssessmentDto>.Validation(string.Join(" ", errors));
        }

        var now = DateTime.UtcNow;
        groupEvent.RamAssessment.Status = EventRamStatus.AwaitingReview;
        groupEvent.RamAssessment.SubmittedByMemberId = request.CurrentMemberId;
        groupEvent.RamAssessment.SubmittedUtc = now;
        groupEvent.RamAssessment.ApprovedByMemberId = null;
        groupEvent.RamAssessment.ApprovedUtc = null;
        groupEvent.RamAssessment.UpdatedUtc = now;
        groupEvent.UpdatedUtc = now;
        await EventWorkflowIntegration.SyncRamAsync(
            dbContext, groupEvent.Id, EventRamStatus.AwaitingReview, groupEvent.RamAssessment.RamDataJson,
            request.CurrentMemberId, now, cancellationToken);
        await packageInvalidationService.InvalidateForMaterialChangeAsync(
            groupEvent, request.CurrentMemberId, "event.ram.submitted", "governanceCritical", cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        await eventCacheInvalidationService.RemoveGroupEventsAsync(groupEvent.GroupId, cancellationToken);

        return AppResult<EventRamAssessmentDto>.Success(EventRamPolicy.ToDto(groupEvent.RamAssessment, groupEvent.GroupId));
    }
}
