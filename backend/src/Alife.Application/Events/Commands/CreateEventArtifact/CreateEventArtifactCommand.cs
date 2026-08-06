using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Domain.Enums;
using MediatR;

namespace Alife.Application.Events.Commands.CreateEventArtifact;

public sealed record CreateEventArtifactCommand(
    Guid EventId,
    Guid CurrentMemberId,
    Guid? WorkflowStepId,
    string ArtifactType,
    string TitleEn,
    string TitleZh,
    bool IsRequired,
    FileAssetVisibility Visibility,
    Guid? FileAssetId,
    string DataJson) : IRequest<AppResult<EventArtifactDto>>;
