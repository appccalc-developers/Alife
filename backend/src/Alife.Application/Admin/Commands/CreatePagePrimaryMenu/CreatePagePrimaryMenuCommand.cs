using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Models;
using Alife.Domain.Enums;
using MediatR;

namespace Alife.Application.Admin.Commands.CreatePagePrimaryMenu;

public sealed record CreatePagePrimaryMenuCommand(
    Guid CurrentMemberId,
    IReadOnlyDictionary<string, string>? Name,
    PagePrimaryMenuHomePlacement? HomePlacement = null)
    : IRequest<AppResult<AdminPagePrimaryMenuDto>>;
