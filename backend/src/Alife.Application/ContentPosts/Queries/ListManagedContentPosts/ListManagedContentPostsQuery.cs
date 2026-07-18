using Alife.Application.Common.Models;
using Alife.Application.ContentPosts.Dtos;
using MediatR;

namespace Alife.Application.ContentPosts.Queries.ListManagedContentPosts;

public sealed record ListManagedContentPostsQuery(Guid GroupId, Guid CurrentMemberId)
    : IRequest<AppResult<IReadOnlyList<ManagedContentPostDto>>>;
