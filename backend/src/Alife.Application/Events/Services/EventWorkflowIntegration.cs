using Alife.Application.Common.Interfaces;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Services;

public static class EventWorkflowIntegration
{
    public static async Task SyncRamAsync(
        IAlifeDbContext dbContext,
        Guid eventId,
        EventRamStatus ramStatus,
        string ramDataJson,
        Guid? actorMemberId,
        DateTime now,
        CancellationToken cancellationToken)
    {
        var run = await dbContext.EventWorkflowRuns
            .Include(x => x.Steps)
                .ThenInclude(x => x.Artifacts)
            .FirstOrDefaultAsync(x => x.EventId == eventId, cancellationToken);
        if (run is null) return;

        var step = run.Steps.FirstOrDefault(x => x.IntegrationKey == "ram");
        if (step is null) return;
        step.Status = ramStatus switch
        {
            EventRamStatus.Approved => EventWorkflowStepStatus.Completed,
            EventRamStatus.AwaitingReview => EventWorkflowStepStatus.AwaitingApproval,
            _ => EventWorkflowStepStatus.InProgress
        };
        step.CompletedByMemberId = ramStatus == EventRamStatus.Approved ? actorMemberId : null;
        step.CompletedUtc = ramStatus == EventRamStatus.Approved ? now : null;
        step.UpdatedUtc = now;

        foreach (var artifact in step.Artifacts.Where(x => x.ArtifactType == "ram"))
        {
            artifact.Status = ramStatus switch
            {
                EventRamStatus.Approved => EventArtifactStatus.Approved,
                EventRamStatus.AwaitingReview => EventArtifactStatus.Submitted,
                _ => EventArtifactStatus.Draft
            };
            artifact.DataJson = ramDataJson;
            artifact.ApprovedByMemberId = ramStatus == EventRamStatus.Approved ? actorMemberId : null;
            artifact.ApprovedUtc = ramStatus == EventRamStatus.Approved ? now : null;
            artifact.UpdatedUtc = now;
        }

        EventWorkflowDefinition.RecalculateRun(run, now);
    }
}
