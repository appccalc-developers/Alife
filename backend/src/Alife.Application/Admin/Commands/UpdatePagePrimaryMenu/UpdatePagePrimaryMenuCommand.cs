using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Models;
using Alife.Domain.Enums;
using MediatR;

namespace Alife.Application.Admin.Commands.UpdatePagePrimaryMenu;

public sealed record UpdatePagePrimaryMenuCommand(
    Guid CurrentMemberId,
    Guid PrimaryMenuId,
    IReadOnlyDictionary<string, string>? Name,
    PagePrimaryMenuHomePlacement? HomePlacement = null)
    : IRequest<AppResult<AdminPagePrimaryMenuDto>>;
