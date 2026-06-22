using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Admin.Queries.ListAdminMembers;

public sealed record ListAdminMembersQuery(
    Guid CurrentMemberId,
    string? Search,
    string? Role,
    bool? IsRegistered,
    int Page = 1,
    int PageSize = 25)
    : IRequest<AppResult<AdminPagedResultDto<AdminMemberDto>>>;
