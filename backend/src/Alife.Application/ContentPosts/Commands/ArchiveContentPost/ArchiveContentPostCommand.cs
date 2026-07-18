using Alife.Application.Common.Models;
using Alife.Application.ContentPosts.Dtos;
using MediatR;

namespace Alife.Application.ContentPosts.Commands.ArchiveContentPost;

public sealed record ArchiveContentPostCommand(Guid ContentPostId, Guid CurrentMemberId)
    : IRequest<AppResult<ManagedContentPostDto>>;
