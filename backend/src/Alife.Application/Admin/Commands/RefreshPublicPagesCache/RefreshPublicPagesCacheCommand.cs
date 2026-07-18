using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Admin.Commands.RefreshPublicPagesCache;

public sealed record RefreshPublicPagesCacheCommand(Guid CurrentMemberId)
    : IRequest<AppResult<AdminActionResultDto>>;
