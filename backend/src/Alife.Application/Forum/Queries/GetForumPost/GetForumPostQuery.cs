using Alife.Application.Common.Models;
using Alife.Application.Forum.Dtos;
using MediatR;

namespace Alife.Application.Forum.Queries.GetForumPost;

public sealed record GetForumPostQuery(Guid PostId, Guid? CurrentMemberId)
	: IRequest<AppResult<ForumPostDetailDto>>;
