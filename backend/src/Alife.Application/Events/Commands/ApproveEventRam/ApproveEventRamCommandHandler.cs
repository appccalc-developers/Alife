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
    IAlifeDbContext dbContext)
    : IRequestHandler<ApproveEventRamCommand, AppResult<EventRamAssessmentDto>>
{
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

        return AppResult<EventRamAssessmentDto>.Conflict(EventRamGovernanceService.UpgradeMessage);
    }
}
