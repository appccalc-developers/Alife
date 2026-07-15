using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Admin.Commands.DeletePagePrimaryMenu;

public sealed record DeletePagePrimaryMenuCommand(Guid CurrentMemberId, Guid PrimaryMenuId)
    : IRequest<AppResult<AdminActionResultDto>>;
