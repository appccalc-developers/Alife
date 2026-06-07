using Alife.Application.Common.Models;
using Alife.Application.Groups.Dtos;
using Alife.Application.Groups.Services;
using MediatR;

namespace Alife.Application.Groups.Queries.GetGroupById;

public sealed class GetGroupByIdQueryHandler(
    IGroupReadService groupReadService,
    IGroupAuthorizationService groupAuthorizationService)
    : IRequestHandler<GetGroupByIdQuery, AppResult<GroupDto>>
{
    public async Task<AppResult<GroupDto>> Handle(GetGroupByIdQuery request, CancellationToken cancellationToken)
    {
        var group = await groupReadService.GetByIdAsync(request.GroupId, cancellationToken);
        if (group is null)
        {
            return AppResult<GroupDto>.NotFound("Group was not found.");
        }

        if (group.IsChurch)
        {
            return AppResult<GroupDto>.Success(group);
        }

        var isRegistered = request.CurrentMemberId.HasValue &&
            await groupAuthorizationService.IsRegisteredMemberAsync(request.CurrentMemberId.Value, cancellationToken);

        return isRegistered
            ? AppResult<GroupDto>.Success(group)
            : AppResult<GroupDto>.Forbidden("Guest members cannot access non-church groups.");
    }
}
