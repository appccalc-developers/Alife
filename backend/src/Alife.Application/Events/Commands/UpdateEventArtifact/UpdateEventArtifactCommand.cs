using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Domain.Enums;
using MediatR;

namespace Alife.Application.Events.Commands.UpdateEventArtifact;

public sealed record UpdateEventArtifactCommand(
    Guid EventId,
    Guid ArtifactId,
    Guid CurrentMemberId,
    string TitleEn,
    string TitleZh,
    EventArtifactStatus Status,
    FileAssetVisibility Visibility,
    Guid? FileAssetId,
    string DataJson) : IRequest<AppResult<EventArtifactDto>>;
