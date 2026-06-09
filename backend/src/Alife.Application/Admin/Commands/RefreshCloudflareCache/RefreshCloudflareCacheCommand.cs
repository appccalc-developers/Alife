using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Admin.Commands.RefreshCloudflareCache;

public sealed record RefreshCloudflareCacheCommand(
    Guid CurrentMemberId,
    Guid GroupId) : IRequest<AppResult<AdminActionResultDto>>;
