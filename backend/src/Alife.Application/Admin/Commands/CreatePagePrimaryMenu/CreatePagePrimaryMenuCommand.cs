using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Admin.Commands.CreatePagePrimaryMenu;

public sealed record CreatePagePrimaryMenuCommand(
    Guid CurrentMemberId,
    IReadOnlyDictionary<string, string>? Name)
    : IRequest<AppResult<AdminPagePrimaryMenuDto>>;
