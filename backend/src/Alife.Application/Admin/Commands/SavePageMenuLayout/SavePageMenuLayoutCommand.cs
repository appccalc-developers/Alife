using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Admin.Commands.SavePageMenuLayout;

public sealed record SavePageMenuLayoutCommand(
    Guid CurrentMemberId,
    IReadOnlyList<PagePrimaryMenuLayoutItemDto> Menus)
    : IRequest<AppResult<AdminActionResultDto>>;
