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
        var isRegistered = await groupAuthorizationService.IsRegisteredMemberAsync(request.CurrentMemberId, cancellationToken);
        if (!isRegistered)
        {
            return AppResult<GroupDto>.Forbidden("Guest members cannot access groups.");
        }

        var group = await groupReadService.GetByIdAsync(request.GroupId, cancellationToken);
        return group is null
            ? AppResult<GroupDto>.NotFound("Group was not found.")
            : AppResult<GroupDto>.Success(group);
    }
}
