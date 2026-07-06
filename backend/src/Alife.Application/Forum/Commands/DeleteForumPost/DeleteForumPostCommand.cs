using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Forum.Commands.DeleteForumPost;

public sealed record DeleteForumPostCommand(Guid PostId, Guid CurrentMemberId)
	: IRequest<AppResult<bool>>;
