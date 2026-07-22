using Alife.Application.Admin;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Queries.GetEventRam;

public sealed class GetEventRamQueryHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService)
    : IRequestHandler<GetEventRamQuery, AppResult<EventRamAssessmentDto>>
{
    public async Task<AppResult<EventRamAssessmentDto>> Handle(GetEventRamQuery request, CancellationToken cancellationToken)
    {
        var groupEvent = await dbContext.GroupEvents
            .AsNoTracking()
            .Include(x => x.RamAssessment)
            .FirstOrDefaultAsync(x => x.Id == request.EventId, cancellationToken);
        if (groupEvent?.RamAssessment is null)
        {
            return AppResult<EventRamAssessmentDto>.NotFound("RAM draft not found.");
        }

        var canManage = await groupAuthorizationService.IsLeaderOrCoLeaderAsync(
            groupEvent.GroupId, request.CurrentMemberId, cancellationToken);
        var canAudit = await AdminPlatformRoleHelpers.HasPermissionAsync(
            dbContext, request.CurrentMemberId, AdminPermissionCatalog.AuditEvents, cancellationToken);
        if (!canManage && !canAudit)
        {
            return AppResult<EventRamAssessmentDto>.Forbidden("RAM details are restricted to group leaders and event auditors.");
        }

        return AppResult<EventRamAssessmentDto>.Success(EventRamPolicy.ToDto(groupEvent.RamAssessment, groupEvent.GroupId));
    }
}
