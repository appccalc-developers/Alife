using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Members.Dtos;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Members.Queries.GetMembers;

public sealed class GetMembersQueryHandler(IAlifeDbContext dbContext)
    : IRequestHandler<GetMembersQuery, AppResult<IReadOnlyList<MemberSummaryDto>>>
{
    public async Task<AppResult<IReadOnlyList<MemberSummaryDto>>> Handle(
        GetMembersQuery request,
        CancellationToken cancellationToken)
    {
        var members = await dbContext.Members
            .AsNoTracking()
            .Where(x => x.IsRegistered)
            .OrderBy(x => x.DisplayName)
            .Select(x => new MemberSummaryDto(x.Id, x.DisplayName))
            .ToListAsync(cancellationToken);

        return AppResult<IReadOnlyList<MemberSummaryDto>>.Success(members);
    }
}
