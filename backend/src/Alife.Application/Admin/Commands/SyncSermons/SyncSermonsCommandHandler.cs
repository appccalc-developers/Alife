using Alife.Application.Abstractions.Integrations;
using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Models;
using Alife.Application.Groups.Services;
using MediatR;

namespace Alife.Application.Admin.Commands.SyncSermons;

public sealed class SyncSermonsCommandHandler(
    IGroupAuthorizationService groupAuthorizationService,
    IYoutubeService youtubeService)
    : IRequestHandler<SyncSermonsCommand, AppResult<AdminActionResultDto>>
{
    public async Task<AppResult<AdminActionResultDto>> Handle(SyncSermonsCommand request, CancellationToken cancellationToken)
    {
        var isAdmin = await groupAuthorizationService.IsAdminAsync(request.CurrentMemberId, cancellationToken);
        if (!isAdmin)
        {
            return AppResult<AdminActionResultDto>.Forbidden("You do not have permission to sync sermons.");
        }

        await youtubeService.SyncSermonsAsync(cancellationToken);
        return AppResult<AdminActionResultDto>.Success(new AdminActionResultDto(true));
    }
}
