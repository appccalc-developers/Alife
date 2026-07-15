using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Admin.Commands.UpdatePagePrimaryMenu;

public sealed record UpdatePagePrimaryMenuCommand(
    Guid CurrentMemberId,
    Guid PrimaryMenuId,
    IReadOnlyDictionary<string, string>? Name)
    : IRequest<AppResult<AdminPagePrimaryMenuDto>>;
