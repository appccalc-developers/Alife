using Alife.Application.Common.Models;
using Alife.Application.Forum.Dtos;
using MediatR;

namespace Alife.Application.Forum.Commands.SetForumPostModeration;

public sealed record SetForumPostModerationCommand(
	Guid PostId,
	Guid CurrentMemberId,
	bool? IsPinned,
	bool? IsLocked,
	bool? IsHidden)
	: IRequest<AppResult<ForumPostDetailDto>>;
