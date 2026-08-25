using System.Text.Json;
using Alife.Application.Admin;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Commands.ReturnEventRam;

public sealed class ReturnEventRamCommandHandler(
    IAlifeDbContext dbContext,
    IEventCacheInvalidationService eventCacheInvalidationService)
    : IRequestHandler<ReturnEventRamCommand, AppResult<EventRamAssessmentDto>>
{
    public async Task<AppResult<EventRamAssessmentDto>> Handle(ReturnEventRamCommand request, CancellationToken cancellationToken)
    {
        if (!await AdminPlatformRoleHelpers.HasPermissionAsync(
                dbContext, request.CurrentMemberId, AdminPermissionCatalog.AuditEvents, cancellationToken))
        {
            return AppResult<EventRamAssessmentDto>.Forbidden("Event auditor permission is required.");
        }

        var notes = request.DecisionNotes.Trim();
        if (notes.Length is < 3 or > 2000)
        {
            return AppResult<EventRamAssessmentDto>.Validation("A return reason between 3 and 2000 characters is required.");
        }

        var groupEvent = await dbContext.GroupEvents
            .Include(x => x.RamAssessment)
            .Include(x => x.Plan).ThenInclude(x => x!.Modules)
            .Include(x => x.Plan).ThenInclude(x => x!.Decisions)
            .FirstOrDefaultAsync(x => x.Id == request.EventId, cancellationToken);
        if (groupEvent?.RamAssessment is null)
            return AppResult<EventRamAssessmentDto>.NotFound("RAM draft not found.");
        if (groupEvent.RamAssessment.Status != EventRamStatus.AwaitingReview)
            return AppResult<EventRamAssessmentDto>.Conflict("Only a RAM awaiting review can be returned for changes.");

        var decision = EventRamDecisionPolicy.LatestPending(groupEvent.Plan);
        if (decision is null)
            return AppResult<EventRamAssessmentDto>.Conflict("The RAM has no active review request. Ask the event leader to submit it again.");
        if (decision.RequestedByMemberId == request.CurrentMemberId)
            return AppResult<EventRamAssessmentDto>.Forbidden("The person who submitted this RAM cannot review their own request.");

        var now = DateTime.UtcNow;
        decision.Status = EventDecisionStatus.Returned;
        decision.DecidedByMemberId = request.CurrentMemberId;
        decision.DecisionNotes = notes;
        decision.DecidedUtc = now;
        groupEvent.RamAssessment.Status = EventRamStatus.Draft;
        groupEvent.RamAssessment.RamDataJson = EventRamDecisionPolicy.ResetLeaderConfirmation(groupEvent.RamAssessment.RamDataJson);
        groupEvent.RamAssessment.SubmittedByMemberId = null;
        groupEvent.RamAssessment.SubmittedUtc = null;
        groupEvent.RamAssessment.ApprovedByMemberId = null;
        groupEvent.RamAssessment.ApprovedUtc = null;
        groupEvent.RamAssessment.UpdatedUtc = now;
        groupEvent.UpdatedUtc = now;
        dbContext.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            ActorMemberId = request.CurrentMemberId,
            Action = "event.ram.returned",
            EntityType = nameof(EventDecisionRecord),
            EntityId = decision.Id,
            GroupId = groupEvent.GroupId,
            EventId = groupEvent.Id,
            MetadataJson = JsonSerializer.Serialize(new { decisionKey = EventRamDecisionPolicy.DecisionKey }),
            OccurredUtc = now
        });

        await dbContext.SaveChangesAsync(cancellationToken);
        await eventCacheInvalidationService.RemoveGroupEventsAsync(groupEvent.GroupId, cancellationToken);
        return AppResult<EventRamAssessmentDto>.Success(EventRamPolicy.ToDto(groupEvent.RamAssessment, groupEvent.GroupId));
    }
}
