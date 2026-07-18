using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.ContentPosts.Commands.DeleteContentPost;

public sealed record DeleteContentPostCommand(Guid ContentPostId, Guid CurrentMemberId)
    : IRequest<AppResult<bool>>;
