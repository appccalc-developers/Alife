using Alife.Application.Common.Models;
using Alife.Application.Members.Dtos;
using MediatR;

namespace Alife.Application.Members.Queries.GetBibleReadingProgress;

public sealed record GetBibleReadingProgressQuery(Guid MemberId)
    : IRequest<AppResult<BibleReadingProgressDto>>;
