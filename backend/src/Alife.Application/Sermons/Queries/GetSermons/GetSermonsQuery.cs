using Alife.Application.Common.Models;
using Alife.Application.Sermons.Dtos;
using MediatR;

namespace Alife.Application.Sermons.Queries.GetSermons;

public sealed record GetSermonsQuery(int Page, int PageSize) : IRequest<AppResult<PagedResult<SermonDto>>>;
