using Alife.Application.Common.Models;
using Alife.Application.Forum.Dtos;
using Alife.Application.Forum.Services;
using Alife.Domain.Enums;
using MediatR;

namespace Alife.Application.Forum.Commands.CreateForumComment;

public sealed record CreateForumCommentCommand(
	Guid PostId,
	Guid CurrentMemberId,
	Guid? ParentCommentId,
	IReadOnlyDictionary<string, string>? Body,
	IReadOnlyList<ForumMediaInput>? Media,
	ForumCommentVisibility? Visibility = null)
	: IRequest<AppResult<ForumCommentDto>>;
