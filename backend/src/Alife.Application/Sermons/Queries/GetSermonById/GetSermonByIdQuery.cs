using Alife.Application.Common.Models;
using Alife.Application.Sermons.Dtos;
using MediatR;

namespace Alife.Application.Sermons.Queries.GetSermonById;

public sealed record GetSermonByIdQuery(Guid SermonId) : IRequest<AppResult<SermonDto>>;
