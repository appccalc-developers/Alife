using Alife.Application.Common.Models;
using Alife.Application.Forum.Dtos;
using Alife.Application.Forum.Services;
using MediatR;

namespace Alife.Application.Forum.Commands.UpdateForumComment;

public sealed record UpdateForumCommentCommand(
	Guid PostId,
	Guid CommentId,
	Guid CurrentMemberId,
	IReadOnlyDictionary<string, string>? Body,
	IReadOnlyList<ForumMediaInput>? Media)
	: IRequest<AppResult<ForumCommentDto>>;
