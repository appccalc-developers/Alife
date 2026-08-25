using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Venues.Queries.ListManagedVenues;

public sealed class ListManagedVenuesQueryHandler(IAlifeDbContext db)
    : IRequestHandler<ListManagedVenuesQuery, AppResult<IReadOnlyList<VenueDto>>>
{
    public async Task<AppResult<IReadOnlyList<VenueDto>>> Handle(ListManagedVenuesQuery request, CancellationToken cancellationToken)
    {
        if (!await VenueAuthorization.CanManageCatalogAsync(db, request.CurrentMemberId, cancellationToken))
            return AppResult<IReadOnlyList<VenueDto>>.Forbidden("You do not have permission to maintain the venue catalog.");

        var churchExists = await db.Groups.AsNoTracking().AnyAsync(x => x.Id == request.ChurchGroupId && x.IsChurch, cancellationToken);
        if (!churchExists) return AppResult<IReadOnlyList<VenueDto>>.NotFound("Church not found.");

        var venues = await db.Venues.AsNoTracking()
            .Include(x => x.Spaces)
            .Where(x => x.ChurchGroupId == request.ChurchGroupId)
            .OrderBy(x => x.NameEn).ThenBy(x => x.NameZh)
            .ToListAsync(cancellationToken);
        return AppResult<IReadOnlyList<VenueDto>>.Success(venues.Select(VenueMapper.ToDto).ToArray());
    }
}
