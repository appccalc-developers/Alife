using Alife.Application.Common.Models;
using Alife.Application.Pages.Dtos;
using MediatR;

namespace Alife.Application.Pages.Queries.GetPageBySlug;

public sealed record GetPageBySlugQuery(string Slug, string Language, Guid CurrentMemberId)
    : IRequest<AppResult<PageDto>>;
