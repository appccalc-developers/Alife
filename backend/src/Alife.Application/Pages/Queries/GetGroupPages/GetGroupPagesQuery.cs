using Alife.Application.Common.Models;
using Alife.Application.Pages.Dtos;
using MediatR;

namespace Alife.Application.Pages.Queries.GetGroupPages;

public sealed record GetGroupPagesQuery(Guid GroupId, string Language, Guid CurrentMemberId)
    : IRequest<AppResult<IReadOnlyList<PageDto>>>;
