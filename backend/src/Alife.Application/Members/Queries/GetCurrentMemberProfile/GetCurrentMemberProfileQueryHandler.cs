using Alife.Application.Common.Models;
using Alife.Application.Members.Dtos;
using Alife.Application.Members.Services;
using MediatR;

namespace Alife.Application.Members.Queries.GetCurrentMemberProfile;

public sealed class GetCurrentMemberProfileQueryHandler(IMemberReadService memberReadService)
    : IRequestHandler<GetCurrentMemberProfileQuery, AppResult<CurrentMemberDto>>
{
    public async Task<AppResult<CurrentMemberDto>> Handle(
        GetCurrentMemberProfileQuery request,
        CancellationToken cancellationToken)
    {
        var member = await memberReadService.GetCurrentMemberAsync(request.CurrentMemberId, cancellationToken);
        return member is null
            ? AppResult<CurrentMemberDto>.NotFound("Current member was not found.")
            : AppResult<CurrentMemberDto>.Success(member);
    }
}
