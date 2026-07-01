using Alife.Application.Abstractions.Integrations;
using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Admin.Commands.SyncSermons;

public sealed class SyncSermonsCommandHandler(
    IAlifeDbContext dbContext,
    IYoutubeService youtubeService)
    : IRequestHandler<SyncSermonsCommand, AppResult<AdminActionResultDto>>
{
    public async Task<AppResult<AdminActionResultDto>> Handle(SyncSermonsCommand request, CancellationToken cancellationToken)
    {
        if (!await AdminPlatformRoleHelpers.HasPermissionAsync(
                dbContext,
                request.CurrentMemberId,
                AdminPermissionCatalog.SyncSermons,
                cancellationToken))
        {
            return AppResult<AdminActionResultDto>.Forbidden("You do not have permission to sync sermons.");
        }

        await youtubeService.SyncSermonsAsync(cancellationToken);
        return AppResult<AdminActionResultDto>.Success(new AdminActionResultDto(true));
    }
}
