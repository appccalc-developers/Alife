using Alife.Application.Common.Models;
using Alife.Application.Forum.Dtos;
using Alife.Application.Forum.Services;
using Alife.Domain.Enums;
using MediatR;

namespace Alife.Application.Forum.Commands.UpdateForumPost;

public sealed record UpdateForumPostCommand(
	Guid PostId,
	Guid CurrentMemberId,
	Guid CategoryId,
	IReadOnlyDictionary<string, string> Title,
	IReadOnlyDictionary<string, string> Body,
	IReadOnlyList<ForumMediaInput>? Media,
	ForumPostVisibility Visibility)
	: IRequest<AppResult<ForumPostDetailDto>>;
