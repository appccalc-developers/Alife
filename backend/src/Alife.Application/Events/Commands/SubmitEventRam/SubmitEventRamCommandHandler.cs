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
    IGroupAuthorizationService groupAuthorizationService)
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

        return AppResult<EventRamAssessmentDto>.Conflict(EventRamGovernanceService.UpgradeMessage);
    }
}
