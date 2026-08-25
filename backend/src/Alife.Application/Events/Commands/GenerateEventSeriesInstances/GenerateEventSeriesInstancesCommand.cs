using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using MediatR;

namespace Alife.Application.Events.Commands.GenerateEventSeriesInstances;

public sealed record GenerateEventSeriesInstancesCommand(
    Guid SeriesId,
    Guid CurrentMemberId,
    DateOnly? FromLocalDate = null,
    int? HorizonWeeks = null) : IRequest<AppResult<EventSeriesGenerationResultDto>>;
