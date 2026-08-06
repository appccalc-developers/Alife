using System.Text.Json;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Commands.CreateEventArtifact;

public sealed class CreateEventArtifactCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService)
    : IRequestHandler<CreateEventArtifactCommand, AppResult<EventArtifactDto>>
{
    public async Task<AppResult<EventArtifactDto>> Handle(CreateEventArtifactCommand request, CancellationToken cancellationToken)
    {
        var groupId = await dbContext.GroupEvents.AsNoTracking()
            .Where(x => x.Id == request.EventId)
            .Select(x => (Guid?)x.GroupId)
            .FirstOrDefaultAsync(cancellationToken);
        if (groupId is null) return AppResult<EventArtifactDto>.NotFound("Event not found.");
        if (!await groupAuthorizationService.IsLeaderOrCoLeaderAsync(groupId.Value, request.CurrentMemberId, cancellationToken))
            return AppResult<EventArtifactDto>.Forbidden("Only group leaders and co-leaders can add event outputs.");
        if (string.IsNullOrWhiteSpace(request.ArtifactType) || string.IsNullOrWhiteSpace(request.TitleEn) || string.IsNullOrWhiteSpace(request.TitleZh))
            return AppResult<EventArtifactDto>.Validation("Output type and bilingual title are required.");
        if (!IsValidJson(request.DataJson)) return AppResult<EventArtifactDto>.Validation("Output data must be valid JSON.");
        if (request.WorkflowStepId.HasValue && !await dbContext.EventWorkflowSteps.AsNoTracking()
                .AnyAsync(x => x.Id == request.WorkflowStepId && x.WorkflowRun.EventId == request.EventId, cancellationToken))
            return AppResult<EventArtifactDto>.NotFound("Workflow step not found.");
        var fileError = await ValidateFileAsync(request.FileAssetId, groupId.Value, request.Visibility, cancellationToken);
        if (fileError is not null) return fileError;

        var now = DateTime.UtcNow;
        var artifact = new EventArtifact
        {
            Id = Guid.NewGuid(),
            EventId = request.EventId,
            WorkflowStepId = request.WorkflowStepId,
            ArtifactType = NormalizeCode(request.ArtifactType),
            TitleEn = request.TitleEn.Trim(),
            TitleZh = request.TitleZh.Trim(),
            IsRequired = request.IsRequired,
            Status = EventArtifactStatus.Draft,
            Visibility = request.Visibility,
            FileAssetId = request.FileAssetId,
            DataJson = request.DataJson,
            CreatedByMemberId = request.CurrentMemberId,
            CreatedUtc = now,
            UpdatedUtc = now
        };
        dbContext.EventArtifacts.Add(artifact);
        await dbContext.SaveChangesAsync(cancellationToken);
        return AppResult<EventArtifactDto>.Success(EventWorkflowDefinition.ToDto(artifact));
    }

    private async Task<AppResult<EventArtifactDto>?> ValidateFileAsync(
        Guid? fileAssetId,
        Guid groupId,
        FileAssetVisibility visibility,
        CancellationToken cancellationToken)
    {
        if (!fileAssetId.HasValue) return null;
        var file = await dbContext.FileAssets.AsNoTracking().FirstOrDefaultAsync(x => x.Id == fileAssetId, cancellationToken);
        if (file is null || file.GroupId != groupId) return AppResult<EventArtifactDto>.NotFound("File asset not found in this event group.");
        return file.Visibility == visibility
            ? null
            : AppResult<EventArtifactDto>.Validation("Output visibility must match the attached file visibility.");
    }

    private static bool IsValidJson(string value)
    {
        try { using var _ = JsonDocument.Parse(value); return true; }
        catch (JsonException) { return false; }
    }

    private static string NormalizeCode(string value)
        => value.Trim().ToLowerInvariant().Replace('-', '_').Replace(' ', '_');
}
