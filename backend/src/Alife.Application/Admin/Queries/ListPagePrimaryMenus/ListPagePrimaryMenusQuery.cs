using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Admin.Queries.ListPagePrimaryMenus;

public sealed record ListPagePrimaryMenusQuery(Guid CurrentMemberId)
    : IRequest<AppResult<IReadOnlyList<AdminPagePrimaryMenuDto>>>;
