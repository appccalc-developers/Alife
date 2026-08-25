using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using MediatR;

namespace Alife.Application.Events.Commands.SaveEventPreparationTask;

public sealed record SaveEventPreparationTaskCommand(
    Guid EventId,
    Guid? TaskId,
    Guid CurrentMemberId,
    string ModuleKey,
    string TitleEn,
    string TitleZh,
    string DescriptionEn,
    string DescriptionZh,
    Guid? AssignedMemberId,
    DateTime? DueUtc,
    bool IsRequired,
    IReadOnlyList<Guid> DependencyTaskIds)
    : IRequest<AppResult<EventPreparationTaskDto>>;
