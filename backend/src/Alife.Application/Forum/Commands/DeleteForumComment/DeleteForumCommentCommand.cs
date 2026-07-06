using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Forum.Commands.DeleteForumComment;

public sealed record DeleteForumCommentCommand(
	Guid PostId,
	Guid CommentId,
	Guid CurrentMemberId)
	: IRequest<AppResult<bool>>;
