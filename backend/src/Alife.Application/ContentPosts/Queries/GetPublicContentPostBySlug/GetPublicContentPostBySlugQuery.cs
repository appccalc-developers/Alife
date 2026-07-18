using Alife.Application.Common.Models;
using Alife.Application.ContentPosts.Dtos;
using MediatR;

namespace Alife.Application.ContentPosts.Queries.GetPublicContentPostBySlug;

public sealed record GetPublicContentPostBySlugQuery(Guid GroupId, string Slug)
    : IRequest<AppResult<ContentPostDetailDto>>;
