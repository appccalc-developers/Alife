using Alife.Application.Common.Models;
using Alife.Application.Forum.Dtos;
using MediatR;

namespace Alife.Application.Forum.Queries.GetSermonForumPost;

public sealed record GetSermonForumPostQuery(Guid SermonId, Guid? CurrentMemberId)
	: IRequest<AppResult<ForumPostDetailDto>>;
