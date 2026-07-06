using Alife.Application.Common.Models;
using Alife.Application.Forum.Dtos;
using Alife.Application.Forum.Services;
using Alife.Domain.Enums;
using MediatR;

namespace Alife.Application.Forum.Commands.CreateForumPost;

public sealed record CreateForumPostCommand(
	Guid CurrentMemberId,
	Guid CategoryId,
	Guid? GroupId,
	IReadOnlyDictionary<string, string> Title,
	IReadOnlyDictionary<string, string> Body,
	IReadOnlyList<ForumMediaInput>? Media,
	ForumPostVisibility Visibility)
	: IRequest<AppResult<ForumPostDetailDto>>;
