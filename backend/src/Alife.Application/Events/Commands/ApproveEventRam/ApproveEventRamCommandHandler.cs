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

namespace Alife.Application.Events.Commands.ApproveEventRam;

public sealed class ApproveEventRamCommandHandler(
    IAlifeDbContext dbContext,
    IEventCacheInvalidationService eventCacheInvalidationService,
    IEventPackageInvalidationService packageInvalidationService)
    : IRequestHandler<ApproveEventRamCommand, AppResult<EventRamAssessmentDto>>
{
    private const string EventCreatedActionType = "event.created";
    private static readonly JsonSerializerOptions NotificationJsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<AppResult<EventRamAssessmentDto>> Handle(ApproveEventRamCommand request, CancellationToken cancellationToken)
    {
        if (!await AdminPlatformRoleHelpers.HasPermissionAsync(
                dbContext, request.CurrentMemberId, AdminPermissionCatalog.AuditEvents, cancellationToken))
        {
            return AppResult<EventRamAssessmentDto>.Forbidden("Event auditor permission is required.");
        }

        var groupEvent = await dbContext.GroupEvents
            .Include(x => x.RamAssessment)
            .FirstOrDefaultAsync(x => x.Id == request.EventId, cancellationToken);
        if (groupEvent?.RamAssessment is null)
        {
            return AppResult<EventRamAssessmentDto>.NotFound("RAM draft not found.");
        }

        if (groupEvent.RamAssessment.Status != EventRamStatus.AwaitingReview)
        {
            return AppResult<EventRamAssessmentDto>.Conflict("Only a RAM awaiting review can be approved.");
        }

        var errors = EventRamPolicy.ValidateForReview(groupEvent.RamAssessment.RamDataJson);
        if (errors.Count > 0)
        {
            return AppResult<EventRamAssessmentDto>.Validation(string.Join(" ", errors));
        }

        var now = DateTime.UtcNow;
        groupEvent.RamAssessment.Status = EventRamStatus.Approved;
        groupEvent.RamAssessment.ApprovedByMemberId = request.CurrentMemberId;
        groupEvent.RamAssessment.ApprovedUtc = now;
        groupEvent.RamAssessment.UpdatedUtc = now;
        groupEvent.UpdatedUtc = now;
        await EventWorkflowIntegration.SyncRamAsync(
            dbContext, groupEvent.Id, EventRamStatus.Approved, groupEvent.RamAssessment.RamDataJson,
            request.CurrentMemberId, now, cancellationToken);

        var recipientMemberIds = await dbContext.GroupMemberships
            .AsNoTracking()
            .Where(x => x.GroupId == groupEvent.GroupId && x.Status == MembershipStatus.Approved)
            .Select(x => x.MemberId)
            .Distinct()
            .ToListAsync(cancellationToken);
        var actionDataJson = JsonSerializer.Serialize(new
        {
            eventId = groupEvent.Id,
            groupId = groupEvent.GroupId,
            title = new { en = groupEvent.TitleEn, zh = groupEvent.TitleZh },
            startDate = groupEvent.StartDate,
            endDate = groupEvent.EndDate
        }, NotificationJsonOptions);
        dbContext.NotificationMessages.AddRange(recipientMemberIds.Select(memberId => new NotificationMessage
        {
            Id = Guid.NewGuid(),
            RecipientMemberId = memberId,
            CreatedByMemberId = request.CurrentMemberId,
            GroupId = groupEvent.GroupId,
            EventId = groupEvent.Id,
            OccurredUtc = now,
            ActionType = EventCreatedActionType,
            ActionDataJson = actionDataJson,
            CreatedUtc = now,
            UpdatedUtc = now
        }));

        await packageInvalidationService.InvalidateForMaterialChangeAsync(
            groupEvent, request.CurrentMemberId, "event.ram.approved", "governanceCritical", cancellationToken);

        await dbContext.SaveChangesAsync(cancellationToken);
        await eventCacheInvalidationService.RemoveGroupEventsAsync(groupEvent.GroupId, cancellationToken);
        return AppResult<EventRamAssessmentDto>.Success(EventRamPolicy.ToDto(groupEvent.RamAssessment, groupEvent.GroupId));
    }
}
