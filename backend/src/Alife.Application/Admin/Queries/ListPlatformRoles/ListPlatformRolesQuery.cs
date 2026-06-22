using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Admin.Queries.ListPlatformRoles;

public sealed record ListPlatformRolesQuery(Guid CurrentMemberId) : IRequest<AppResult<IReadOnlyList<AdminPlatformRoleDto>>>;
