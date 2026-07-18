using Alife.Application.Common.Models;
using Alife.Application.ContentPosts.Dtos;
using MediatR;

namespace Alife.Application.ContentPosts.Queries.GetPublicContentPosts;

public sealed record GetPublicContentPostsQuery(Guid GroupId)
    : IRequest<AppResult<IReadOnlyList<ContentPostSummaryDto>>>;
