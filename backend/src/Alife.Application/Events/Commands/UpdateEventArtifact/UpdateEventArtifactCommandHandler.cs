using System.Text.Json;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Commands.UpdateEventArtifact;

public sealed class UpdateEventArtifactCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService)
    : IRequestHandler<UpdateEventArtifactCommand, AppResult<EventArtifactDto>>
{
    public async Task<AppResult<EventArtifactDto>> Handle(UpdateEventArtifactCommand request, CancellationToken cancellationToken)
    {
        var artifact = await dbContext.EventArtifacts
            .Include(x => x.Event)
            .FirstOrDefaultAsync(x => x.Id == request.ArtifactId && x.EventId == request.EventId, cancellationToken);
        if (artifact is null) return AppResult<EventArtifactDto>.NotFound("Event output not found.");
        if (!await groupAuthorizationService.IsLeaderOrCoLeaderAsync(artifact.Event.GroupId, request.CurrentMemberId, cancellationToken))
            return AppResult<EventArtifactDto>.Forbidden("Only group leaders and co-leaders can update event outputs.");
        if (artifact.ArtifactType == "ram")
            return AppResult<EventArtifactDto>.Conflict("RAM output is managed by the dedicated RAM workflow.");
        if (string.IsNullOrWhiteSpace(request.TitleEn) || string.IsNullOrWhiteSpace(request.TitleZh))
            return AppResult<EventArtifactDto>.Validation("A bilingual output title is required.");
        if (!IsValidJson(request.DataJson)) return AppResult<EventArtifactDto>.Validation("Output data must be valid JSON.");

        if (request.FileAssetId.HasValue)
        {
            var file = await dbContext.FileAssets.AsNoTracking().FirstOrDefaultAsync(x => x.Id == request.FileAssetId, cancellationToken);
            if (file is null || file.GroupId != artifact.Event.GroupId)
                return AppResult<EventArtifactDto>.NotFound("File asset not found in this event group.");
            if (file.Visibility != request.Visibility)
                return AppResult<EventArtifactDto>.Validation("Output visibility must match the attached file visibility.");
        }

        var now = DateTime.UtcNow;
        artifact.TitleEn = request.TitleEn.Trim();
        artifact.TitleZh = request.TitleZh.Trim();
        artifact.Status = request.Status;
        artifact.Visibility = request.Visibility;
        artifact.FileAssetId = request.FileAssetId;
        artifact.DataJson = request.DataJson;
        artifact.ApprovedByMemberId = request.Status == EventArtifactStatus.Approved ? request.CurrentMemberId : null;
        artifact.ApprovedUtc = request.Status == EventArtifactStatus.Approved ? now : null;
        artifact.UpdatedUtc = now;
        await dbContext.SaveChangesAsync(cancellationToken);
        return AppResult<EventArtifactDto>.Success(EventWorkflowDefinition.ToDto(artifact));
    }

    private static bool IsValidJson(string value)
    {
        try { using var _ = JsonDocument.Parse(value); return true; }
        catch (JsonException) { return false; }
    }
}
