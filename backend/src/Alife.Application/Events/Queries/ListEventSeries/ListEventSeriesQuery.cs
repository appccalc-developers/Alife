using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using MediatR;

namespace Alife.Application.Events.Queries.ListEventSeries;

public sealed record ListEventSeriesQuery(Guid GroupId, Guid CurrentMemberId)
    : IRequest<AppResult<IReadOnlyList<EventSeriesDto>>>;
