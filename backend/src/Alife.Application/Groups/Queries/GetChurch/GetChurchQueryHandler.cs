using Alife.Application.Common.Models;
using Alife.Application.Groups.Dtos;
using Alife.Application.Groups.Services;
using MediatR;

namespace Alife.Application.Groups.Queries.GetChurch;

public sealed class GetChurchQueryHandler(
    IGroupReadService groupReadService,
    IGroupAuthorizationService groupAuthorizationService)
    : IRequestHandler<GetChurchQuery, AppResult<GroupDto>>
{
    public async Task<AppResult<GroupDto>> Handle(GetChurchQuery request, CancellationToken cancellationToken)
    {
        var isRegistered = await groupAuthorizationService.IsRegisteredMemberAsync(request.CurrentMemberId, cancellationToken);
        if (!isRegistered)
        {
            return AppResult<GroupDto>.Forbidden("Guest members cannot access groups.");
        }

        var church = await groupReadService.GetChurchAsync(cancellationToken);
        return church is null
            ? AppResult<GroupDto>.NotFound("Church group was not found.")
            : AppResult<GroupDto>.Success(church);
    }
}
