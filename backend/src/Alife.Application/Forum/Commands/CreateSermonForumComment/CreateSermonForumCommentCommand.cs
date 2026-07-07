using Alife.Application.Common.Models;
using Alife.Application.Forum.Dtos;
using Alife.Application.Forum.Services;
using MediatR;

namespace Alife.Application.Forum.Commands.CreateSermonForumComment;

public sealed record CreateSermonForumCommentCommand(
	Guid SermonId,
	Guid CurrentMemberId,
	Guid? ParentCommentId,
	IReadOnlyDictionary<string, string>? Body,
	IReadOnlyList<ForumMediaInput>? Media)
	: IRequest<AppResult<ForumPostDetailDto>>;
