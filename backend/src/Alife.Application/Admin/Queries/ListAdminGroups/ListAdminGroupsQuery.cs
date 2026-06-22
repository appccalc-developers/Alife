using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Admin.Queries.ListAdminGroups;

public sealed record ListAdminGroupsQuery(Guid CurrentMemberId, string? Search, int Page = 1, int PageSize = 50)
    : IRequest<AppResult<AdminPagedResultDto<AdminGroupOptionDto>>>;
